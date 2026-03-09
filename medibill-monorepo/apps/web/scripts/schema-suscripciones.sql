-- =====================================================================
-- SCHEMA: Suscripciones, Organizaciones y Multi-Tenancy — Medibill
-- Base de datos: Supabase (PostgreSQL 15+)
-- Fecha: 2026-03-07
-- =====================================================================

-- 1. ORGANIZACIONES (tenant principal — reemplaza user_id como aislamiento)
CREATE TABLE IF NOT EXISTS organizaciones (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre               TEXT NOT NULL,
  nit                  TEXT,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('independiente', 'clinica')),
  logo_url             TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),

  -- Datos de facturación de la plataforma (cobro de suscripción)
  email_billing        TEXT NOT NULL,

  -- Wompi
  wompi_customer_id    TEXT UNIQUE,
  wompi_payment_source TEXT,              -- Token de tarjeta tokenizada

  -- Límites actuales (denormalizados del plan para queries rápidos)
  max_usuarios         INT NOT NULL DEFAULT 1,
  max_clasificaciones  INT,               -- NULL = ilimitado
  max_facturas_dian    INT,               -- NULL = ilimitado
  storage_gb           NUMERIC(6,2) NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_org_wompi ON organizaciones(wompi_customer_id)
  WHERE wompi_customer_id IS NOT NULL;


-- 2. PLANES DE SUSCRIPCIÓN (catálogo)
CREATE TABLE IF NOT EXISTS planes (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  precio_cop_mensual    NUMERIC(12,2) NOT NULL,
  precio_cop_anual      NUMERIC(12,2),
  max_usuarios          INT NOT NULL DEFAULT 1,
  max_clasificaciones   INT,               -- NULL = ilimitado
  max_facturas_dian     INT,               -- NULL = ilimitado
  storage_gb            NUMERIC(6,2) NOT NULL DEFAULT 1,
  -- Feature flags
  ia_sugerencias_glosas BOOLEAN DEFAULT false,
  importacion_sabana    BOOLEAN DEFAULT false,
  importacion_masiva    BOOLEAN DEFAULT false,
  soporte_nivel         TEXT DEFAULT 'email'
                        CHECK (soporte_nivel IN ('email', 'email_chat', 'prioritario', 'dedicado')),
  activo                BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);


-- 3. SUSCRIPCIONES (una por organización)
CREATE TABLE IF NOT EXISTS suscripciones (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacion_id        UUID NOT NULL UNIQUE REFERENCES organizaciones(id) ON DELETE CASCADE,
  plan_id                TEXT NOT NULL REFERENCES planes(id),
  estado                 TEXT NOT NULL DEFAULT 'trialing'
                         CHECK (estado IN (
                           'trialing', 'active', 'past_due',
                           'canceled', 'paused', 'incomplete'
                         )),
  periodo                TEXT NOT NULL DEFAULT 'mensual'
                         CHECK (periodo IN ('mensual', 'anual')),

  -- Wompi
  wompi_subscription_id  TEXT UNIQUE,

  -- Fechas
  trial_inicio           TIMESTAMPTZ,
  trial_fin              TIMESTAMPTZ,
  periodo_actual_inicio  TIMESTAMPTZ,
  periodo_actual_fin     TIMESTAMPTZ,
  cancelada_al_final     BOOLEAN DEFAULT false,

  -- Seats (para plan Clínica)
  cantidad_seats         INT NOT NULL DEFAULT 1,

  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suscripciones_estado ON suscripciones(estado);


-- 4. USUARIOS DE ORGANIZACIÓN (relación user ↔ org con rol)
CREATE TABLE IF NOT EXISTS usuarios_organizacion (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol             TEXT NOT NULL DEFAULT 'doctor'
                  CHECK (rol IN ('owner', 'admin', 'doctor', 'facturador', 'auditor')),
  activo          BOOLEAN NOT NULL DEFAULT true,
  invitado_por    UUID REFERENCES auth.users(id),
  invitado_email  TEXT,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organizacion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_org_user ON usuarios_organizacion(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_org_org  ON usuarios_organizacion(organizacion_id);


-- 5. INVITACIONES PENDIENTES
CREATE TABLE IF NOT EXISTS invitaciones (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacion_id  UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  rol              TEXT NOT NULL DEFAULT 'doctor',
  token            TEXT NOT NULL UNIQUE,
  invitado_por     UUID NOT NULL REFERENCES auth.users(id),
  expira_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  usado            BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organizacion_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON invitaciones(token);
CREATE INDEX IF NOT EXISTS idx_invitaciones_email ON invitaciones(email);


-- 6. USO MENSUAL (tracking para límites y facturación)
CREATE TABLE IF NOT EXISTS uso_mensual (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacion_id      UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  periodo              TEXT NOT NULL,       -- 'YYYY-MM'
  clasificaciones_ia   INT NOT NULL DEFAULT 0,
  facturas_dian        INT NOT NULL DEFAULT 0,
  storage_usado_mb     NUMERIC(12,2) DEFAULT 0,
  usuarios_activos     INT NOT NULL DEFAULT 0,

  -- Overage
  facturas_adicionales INT NOT NULL DEFAULT 0,
  costo_adicional_cop  NUMERIC(12,2) DEFAULT 0,

  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organizacion_id, periodo)
);


-- 7. HISTORIAL DE PAGOS (mirror de transacciones Wompi)
CREATE TABLE IF NOT EXISTS historial_pagos (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacion_id      UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  wompi_transaction_id TEXT UNIQUE,
  monto_cop            NUMERIC(12,2) NOT NULL,
  estado               TEXT NOT NULL CHECK (estado IN ('paid', 'pending', 'declined', 'voided', 'error')),
  descripcion          TEXT,
  periodo              TEXT,               -- 'YYYY-MM'
  fecha_pago           TIMESTAMPTZ,
  metodo_pago          TEXT,               -- 'card', 'pse', 'nequi'
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_org ON historial_pagos(organizacion_id);


-- =====================================================================
-- SEED: PLANES INICIALES
-- =====================================================================
INSERT INTO planes (
  id, nombre, precio_cop_mensual, precio_cop_anual,
  max_usuarios, max_clasificaciones, max_facturas_dian, storage_gb,
  ia_sugerencias_glosas, importacion_sabana, importacion_masiva, soporte_nivel
) VALUES
  ('starter',     'Starter',      99000,   990000,  1,  100,  50,    1, false, false, false, 'email'),
  ('profesional', 'Profesional', 199000,  1990000,  1,  500, 200,    5, true,  true,  false, 'email_chat'),
  ('clinica',     'Clínica',     149000,  1490000, 20, NULL, NULL,  20, true,  true,  true,  'prioritario')
ON CONFLICT (id) DO NOTHING;


-- =====================================================================
-- MIGRACIÓN: agregar organizacion_id a tablas existentes
-- =====================================================================
ALTER TABLE perfiles                 ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE facturas                 ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE resoluciones_facturacion ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE acuerdos_voluntades      ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE pacientes                ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE auditorias_rips          ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);

CREATE INDEX IF NOT EXISTS idx_facturas_org      ON facturas(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_resoluciones_org  ON resoluciones_facturacion(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_org     ON pacientes(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_auditorias_org    ON auditorias_rips(organizacion_id);


-- =====================================================================
-- FUNCIONES HELPER PARA RLS
-- =====================================================================

-- Obtener la organización activa del usuario actual
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organizacion_id
  FROM usuarios_organizacion
  WHERE user_id = auth.uid() AND activo = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verificar si el usuario tiene al menos cierto rol
CREATE OR REPLACE FUNCTION user_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_organizacion
    WHERE user_id = auth.uid()
      AND activo = true
      AND organizacion_id = get_user_org_id()
      AND (
        rol = required_role
        OR rol = 'owner'
        OR (rol = 'admin' AND required_role IN ('doctor', 'facturador', 'auditor'))
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Incremento atómico de uso mensual
CREATE OR REPLACE FUNCTION incrementar_uso_mensual(
  p_org_id UUID, p_periodo TEXT, p_campo TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO uso_mensual (organizacion_id, periodo)
  VALUES (p_org_id, p_periodo)
  ON CONFLICT (organizacion_id, periodo) DO NOTHING;

  IF p_campo = 'clasificaciones_ia' THEN
    UPDATE uso_mensual SET clasificaciones_ia = clasificaciones_ia + 1, updated_at = now()
    WHERE organizacion_id = p_org_id AND periodo = p_periodo;
  ELSIF p_campo = 'facturas_dian' THEN
    UPDATE uso_mensual SET facturas_dian = facturas_dian + 1, updated_at = now()
    WHERE organizacion_id = p_org_id AND periodo = p_periodo;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================================
-- RLS PARA TABLAS NUEVAS
-- =====================================================================
ALTER TABLE planes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE suscripciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_organizacion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE uso_mensual             ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_pagos         ENABLE ROW LEVEL SECURITY;

-- Planes: catálogo público de solo lectura (INSERT/UPDATE/DELETE solo vía service_role)
CREATE POLICY "planes_select" ON planes
  FOR SELECT USING (true);

-- Organizaciones: solo la propia
CREATE POLICY "org_select" ON organizaciones
  FOR SELECT USING (id = get_user_org_id());

CREATE POLICY "org_update" ON organizaciones
  FOR UPDATE USING (id = get_user_org_id() AND user_has_role('admin'));

-- Suscripciones: solo la de la propia org
CREATE POLICY "sub_select" ON suscripciones
  FOR SELECT USING (organizacion_id = get_user_org_id());

CREATE POLICY "sub_update" ON suscripciones
  FOR UPDATE USING (organizacion_id = get_user_org_id() AND user_has_role('owner'));

-- Usuarios org: ver miembros de la propia org
CREATE POLICY "miembros_select" ON usuarios_organizacion
  FOR SELECT USING (organizacion_id = get_user_org_id());

CREATE POLICY "miembros_manage" ON usuarios_organizacion
  FOR INSERT WITH CHECK (organizacion_id = get_user_org_id() AND user_has_role('admin'));

CREATE POLICY "miembros_update" ON usuarios_organizacion
  FOR UPDATE USING (organizacion_id = get_user_org_id() AND user_has_role('admin'));

CREATE POLICY "miembros_delete" ON usuarios_organizacion
  FOR DELETE USING (organizacion_id = get_user_org_id() AND user_has_role('admin'));

-- Invitaciones: solo la propia org
CREATE POLICY "inv_select" ON invitaciones
  FOR SELECT USING (organizacion_id = get_user_org_id());

CREATE POLICY "inv_insert" ON invitaciones
  FOR INSERT WITH CHECK (organizacion_id = get_user_org_id() AND user_has_role('admin'));

-- Uso mensual: solo la propia org
CREATE POLICY "uso_select" ON uso_mensual
  FOR SELECT USING (organizacion_id = get_user_org_id());

-- Historial pagos: solo la propia org
CREATE POLICY "pagos_select" ON historial_pagos
  FOR SELECT USING (organizacion_id = get_user_org_id());
