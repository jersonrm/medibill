-- =====================================================================
-- SCHEMA: Sistema de Validación de Glosas y Devoluciones — Medibill
-- Fuente legal: Resolución 2284/2023 (Anexo Técnico 3) +
--               Circular Conjunta 007/2025 (MinSalud + SuperSalud)
-- Base de datos: Supabase (PostgreSQL 15+)
-- Fecha: 2026-03-02
-- =====================================================================

-- 1. CATÁLOGO DE CAUSALES (códigos taxativos, NO editables por EPS)
CREATE TABLE IF NOT EXISTS catalogo_causales_glosa (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo            TEXT NOT NULL CHECK (tipo IN ('devolucion', 'glosa')),
  -- Para glosas: FA, TA, SO, AU, PE, SC. Para devoluciones: DE
  concepto        TEXT NOT NULL,
  concepto_desc   TEXT NOT NULL,
  codigo          TEXT NOT NULL UNIQUE,
  descripcion     TEXT NOT NULL,
  -- Código padre (ej: FA01 es padre de FA0101)
  codigo_padre    TEXT REFERENCES catalogo_causales_glosa(codigo),
  afecta          TEXT CHECK (afecta IN ('total', 'parcial')),
  capa_medibill   SMALLINT NOT NULL CHECK (capa_medibill BETWEEN 1 AND 3),
  prevenible      BOOLEAN NOT NULL DEFAULT true,
  accion_medibill TEXT,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_causales_tipo       ON catalogo_causales_glosa(tipo);
CREATE INDEX IF NOT EXISTS idx_causales_concepto   ON catalogo_causales_glosa(concepto);
CREATE INDEX IF NOT EXISTS idx_causales_codigo     ON catalogo_causales_glosa(codigo);
CREATE INDEX IF NOT EXISTS idx_causales_padre      ON catalogo_causales_glosa(codigo_padre);


-- 2. ACUERDOS DE VOLUNTADES (contrato IPS ↔ EPS con tarifas pactadas)
CREATE TABLE IF NOT EXISTS acuerdos_voluntades (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestador_id            UUID NOT NULL,
  eps_codigo              TEXT NOT NULL,
  nombre_eps              TEXT,
  fecha_inicio            DATE NOT NULL,
  fecha_fin               DATE NOT NULL,
  requiere_autorizacion   BOOLEAN NOT NULL DEFAULT true,
  tarifario_base          TEXT DEFAULT 'SOAT',                  -- SOAT, ISS, propio
  porcentaje_sobre_base   NUMERIC(6,2) DEFAULT 100,
  observaciones           TEXT,
  activo                  BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acuerdos_prestador ON acuerdos_voluntades(prestador_id);
CREATE INDEX IF NOT EXISTS idx_acuerdos_eps       ON acuerdos_voluntades(eps_codigo);
CREATE INDEX IF NOT EXISTS idx_acuerdos_vigencia  ON acuerdos_voluntades(fecha_inicio, fecha_fin);


-- 3. TARIFAS ESPECÍFICAS POR SERVICIO EN CADA ACUERDO
CREATE TABLE IF NOT EXISTS acuerdo_tarifas (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  acuerdo_id                  UUID NOT NULL REFERENCES acuerdos_voluntades(id) ON DELETE CASCADE,
  cups_codigo                 TEXT NOT NULL,
  valor_pactado               NUMERIC(18,2) NOT NULL,
  incluye_honorarios          BOOLEAN DEFAULT true,
  incluye_materiales          BOOLEAN DEFAULT true,
  es_paquete                  BOOLEAN DEFAULT false,
  servicios_incluidos_paquete TEXT[],                              -- CUPSs incluidos si es paquete
  observaciones               TEXT,
  created_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acuerdo_tarifas_acuerdo ON acuerdo_tarifas(acuerdo_id);
CREATE INDEX IF NOT EXISTS idx_acuerdo_tarifas_cups    ON acuerdo_tarifas(cups_codigo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acuerdo_tarifas_uniq ON acuerdo_tarifas(acuerdo_id, cups_codigo);


-- 4. REGLAS DE COHERENCIA DIAGNÓSTICO ↔ PROCEDIMIENTO
CREATE TABLE IF NOT EXISTS reglas_coherencia (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo              TEXT NOT NULL CHECK (tipo IN (
                        'sexo_diagnostico',
                        'sexo_procedimiento',
                        'edad_diagnostico',
                        'diagnostico_procedimiento'
                    )),
  codigo_referencia TEXT NOT NULL,                              -- CIE-10 o CUPS
  condicion         JSONB NOT NULL,                             -- {"sexo":"F"} o {"edad_min":0,"edad_max":14}
  mensaje_error     TEXT NOT NULL,
  severidad         TEXT NOT NULL CHECK (severidad IN ('error', 'warning'))
                    DEFAULT 'warning',
  activo            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reglas_tipo     ON reglas_coherencia(tipo);
CREATE INDEX IF NOT EXISTS idx_reglas_codigo   ON reglas_coherencia(codigo_referencia);
CREATE INDEX IF NOT EXISTS idx_reglas_activo   ON reglas_coherencia(activo);


-- 5. FACTURAS (cada factura electrónica radicada)
-- (numeración ajustada: tablas 2-4 son acuerdos, tarifas, reglas)
CREATE TABLE IF NOT EXISTS facturas (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL,                    -- médico / IPS
  num_factura         TEXT NOT NULL UNIQUE,
  num_fev             TEXT,                              -- factura electrónica de validación
  nit_prestador       TEXT NOT NULL,
  nit_erp             TEXT NOT NULL,                     -- EPS / ERP
  fecha_expedicion    TIMESTAMPTZ NOT NULL,
  fecha_radicacion    TIMESTAMPTZ,
  fecha_limite_rad    TIMESTAMPTZ,                       -- +22 días hábiles
  valor_total         NUMERIC(18,2) NOT NULL DEFAULT 0,
  valor_glosado       NUMERIC(18,2) NOT NULL DEFAULT 0,
  valor_aceptado      NUMERIC(18,2) NOT NULL DEFAULT 0,
  estado              TEXT NOT NULL DEFAULT 'borrador'
                        CHECK (estado IN (
                          'borrador','radicada','devuelta',
                          'glosada','respondida','conciliada','pagada'
                        )),
  -- JSON completo del FEV-RIPS (Res. 2275)
  fev_rips_json       JSONB,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facturas_user      ON facturas(user_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado    ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_erp       ON facturas(nit_erp);
CREATE INDEX IF NOT EXISTS idx_facturas_fechas    ON facturas(fecha_expedicion, fecha_radicacion);


-- 6. GLOSAS RECIBIDAS (cada glosa/devolución de la EPS sobre una factura)
CREATE TABLE IF NOT EXISTS glosas (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id          UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  -- Código del catálogo (ej: FA0101, DE5601)
  codigo_causal       TEXT NOT NULL REFERENCES catalogo_causales_glosa(codigo),
  tipo                TEXT NOT NULL CHECK (tipo IN ('devolucion', 'glosa')),
  descripcion_erp     TEXT,                              -- texto libre de la EPS
  valor_glosado       NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Datos del servicio específico afectado
  cups_afectado       TEXT,
  cie10_afectado      TEXT,
  num_autorizacion    TEXT,
  fecha_servicio      DATE,
  -- Plazos legales (calculados)
  fecha_formulacion   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_limite_resp   TIMESTAMPTZ,                       -- +15 días hábiles
  -- Clasificación automática Medibill
  capa_medibill       SMALLINT CHECK (capa_medibill BETWEEN 1 AND 3),
  prevenible          BOOLEAN DEFAULT true,
  sugerencia_auto     TEXT,                              -- sugerencia IA
  estado              TEXT NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN (
                          'pendiente','en_revision','respondida',
                          'aceptada','rechazada_erp','conciliada'
                        )),
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glosas_factura     ON glosas(factura_id);
CREATE INDEX IF NOT EXISTS idx_glosas_causal      ON glosas(codigo_causal);
CREATE INDEX IF NOT EXISTS idx_glosas_estado      ON glosas(estado);
CREATE INDEX IF NOT EXISTS idx_glosas_tipo        ON glosas(tipo);
CREATE INDEX IF NOT EXISTS idx_glosas_plazo       ON glosas(fecha_limite_resp);


-- 7. RESPUESTAS A GLOSAS (respuesta del prestador a cada glosa)
CREATE TABLE IF NOT EXISTS respuestas_glosa (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  glosa_id            UUID NOT NULL REFERENCES glosas(id) ON DELETE CASCADE,
  -- RS01=acepta, RS02=subsana, RS03=rechaza improcedente,
  -- RS04=rechaza extemporánea, RS05=rechaza excepción
  codigo_respuesta    TEXT NOT NULL
                        CHECK (codigo_respuesta IN ('RS01','RS02','RS03','RS04','RS05')),
  justificacion       TEXT NOT NULL,
  -- Soporte adjunto (URL en storage)
  soporte_url         TEXT,
  soporte_nombre      TEXT,
  -- Norma o base legal citada
  fundamento_legal    TEXT,
  -- Si RS01 → monto de nota crédito
  valor_nota_credito  NUMERIC(18,2) DEFAULT 0,
  -- Resultado de la ERP tras evaluar la respuesta
  decision_erp        TEXT CHECK (decision_erp IN (
                          'pendiente','levantada','ratificada','parcial'
                      )) DEFAULT 'pendiente',
  fecha_decision_erp  TIMESTAMPTZ,
  observacion_erp     TEXT,
  generada_por        TEXT NOT NULL DEFAULT 'manual'
                        CHECK (generada_por IN ('manual','automatica','ia')),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resp_glosa        ON respuestas_glosa(glosa_id);
CREATE INDEX IF NOT EXISTS idx_resp_codigo       ON respuestas_glosa(codigo_respuesta);
CREATE INDEX IF NOT EXISTS idx_resp_decision     ON respuestas_glosa(decision_erp);


-- 8. VALIDACIONES PRE-RADICACIÓN (hallazgos del validador antes de radicar)
CREATE TABLE IF NOT EXISTS validaciones_pre_radicacion (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id          UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  -- Código causal que se está previniendo
  codigo_causal       TEXT NOT NULL REFERENCES catalogo_causales_glosa(codigo),
  severidad           TEXT NOT NULL CHECK (severidad IN ('error','advertencia','info')),
  mensaje             TEXT NOT NULL,
  campo_afectado      TEXT,                              -- path JSON del campo
  valor_encontrado    TEXT,
  valor_esperado      TEXT,
  resuelta            BOOLEAN DEFAULT false,
  resuelta_en         TIMESTAMPTZ,
  resuelta_por        UUID,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_valid_factura     ON validaciones_pre_radicacion(factura_id);
CREATE INDEX IF NOT EXISTS idx_valid_sev         ON validaciones_pre_radicacion(severidad);
CREATE INDEX IF NOT EXISTS idx_valid_resuelta    ON validaciones_pre_radicacion(resuelta);


-- 9. AUDITORÍA DE PLAZOS (control de tiempos legales)
CREATE TABLE IF NOT EXISTS auditoria_plazos (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entidad             TEXT NOT NULL CHECK (entidad IN ('factura','glosa','respuesta')),
  entidad_id          UUID NOT NULL,
  tipo_plazo          TEXT NOT NULL CHECK (tipo_plazo IN (
                          'radicacion_soportes',        -- 22 días hábiles
                          'devolucion_erp',              -- 5 días hábiles
                          'formulacion_glosa',           -- 20 días hábiles
                          'respuesta_prestador',         -- 15 días hábiles
                          'decision_erp'                 -- 15 días hábiles
                      )),
  fecha_inicio        TIMESTAMPTZ NOT NULL,
  fecha_limite        TIMESTAMPTZ NOT NULL,
  dias_habiles_total  SMALLINT NOT NULL,
  dias_habiles_rest   SMALLINT,
  alerta_enviada      BOOLEAN DEFAULT false,
  vencido             BOOLEAN DEFAULT false,
  -- Si venció, genera silencio administrativo
  silencio_admin      BOOLEAN DEFAULT false,
  -- 'prestador' o 'erp'
  consecuencia_silencio TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plazos_entidad    ON auditoria_plazos(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_plazos_vencido    ON auditoria_plazos(vencido);
CREATE INDEX IF NOT EXISTS idx_plazos_limite     ON auditoria_plazos(fecha_limite);


-- =====================================================================
-- FUNCIONES AUXILIARES
-- =====================================================================

-- Calcula días hábiles entre dos fechas (excluye sábados y domingos)
CREATE OR REPLACE FUNCTION dias_habiles(fecha_ini DATE, fecha_fin DATE)
RETURNS INTEGER AS $$
DECLARE
  dias INTEGER := 0;
  d DATE := fecha_ini;
BEGIN
  WHILE d <= fecha_fin LOOP
    IF EXTRACT(ISODOW FROM d) NOT IN (6, 7) THEN
      dias := dias + 1;
    END IF;
    d := d + INTERVAL '1 day';
  END LOOP;
  RETURN dias - 1; -- no cuenta el día inicial
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Suma N días hábiles a una fecha
CREATE OR REPLACE FUNCTION sumar_dias_habiles(fecha_ini DATE, n INTEGER)
RETURNS DATE AS $$
DECLARE
  resultado DATE := fecha_ini;
  conteo INTEGER := 0;
BEGIN
  WHILE conteo < n LOOP
    resultado := resultado + INTERVAL '1 day';
    IF EXTRACT(ISODOW FROM resultado) NOT IN (6, 7) THEN
      conteo := conteo + 1;
    END IF;
  END LOOP;
  RETURN resultado;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =====================================================================
-- ROW LEVEL SECURITY (Supabase)
-- =====================================================================
ALTER TABLE acuerdos_voluntades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE acuerdo_tarifas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosas                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_glosa            ENABLE ROW LEVEL SECURITY;
ALTER TABLE validaciones_pre_radicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_plazos            ENABLE ROW LEVEL SECURITY;

-- Políticas básicas: el usuario solo ve sus facturas y datos derivados
DROP POLICY IF EXISTS "Usuarios ven sus facturas" ON facturas;
CREATE POLICY "Usuarios ven sus facturas"
  ON facturas FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan sus facturas" ON facturas;
CREATE POLICY "Usuarios insertan sus facturas"
  ON facturas FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus facturas" ON facturas;
CREATE POLICY "Usuarios actualizan sus facturas"
  ON facturas FOR UPDATE USING (auth.uid() = user_id);

-- Glosas: visibles si la factura pertenece al usuario
DROP POLICY IF EXISTS "Usuarios ven glosas de sus facturas" ON glosas;
CREATE POLICY "Usuarios ven glosas de sus facturas"
  ON glosas FOR SELECT USING (
    EXISTS (SELECT 1 FROM facturas f WHERE f.id = glosas.factura_id AND f.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Usuarios insertan glosas" ON glosas;
CREATE POLICY "Usuarios insertan glosas"
  ON glosas FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM facturas f WHERE f.id = glosas.factura_id AND f.user_id = auth.uid())
  );

-- Respuestas: misma lógica transitiva
DROP POLICY IF EXISTS "Usuarios ven respuestas de sus glosas" ON respuestas_glosa;
CREATE POLICY "Usuarios ven respuestas de sus glosas"
  ON respuestas_glosa FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM glosas g
      JOIN facturas f ON f.id = g.factura_id
      WHERE g.id = respuestas_glosa.glosa_id AND f.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuarios insertan respuestas" ON respuestas_glosa;
CREATE POLICY "Usuarios insertan respuestas"
  ON respuestas_glosa FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM glosas g
      JOIN facturas f ON f.id = g.factura_id
      WHERE g.id = respuestas_glosa.glosa_id AND f.user_id = auth.uid()
    )
  );

-- Validaciones pre-radicación
DROP POLICY IF EXISTS "Usuarios ven validaciones de sus facturas" ON validaciones_pre_radicacion;
CREATE POLICY "Usuarios ven validaciones de sus facturas"
  ON validaciones_pre_radicacion FOR SELECT USING (
    EXISTS (SELECT 1 FROM facturas f WHERE f.id = validaciones_pre_radicacion.factura_id AND f.user_id = auth.uid())
  );

-- Auditoría de plazos: lectura libre (datos no sensibles)
DROP POLICY IF EXISTS "Lectura publica plazos" ON auditoria_plazos;
CREATE POLICY "Lectura publica plazos"
  ON auditoria_plazos FOR SELECT USING (true);

-- Acuerdos de voluntades: el usuario solo ve los de su prestador
DROP POLICY IF EXISTS "Usuarios ven sus acuerdos" ON acuerdos_voluntades;
CREATE POLICY "Usuarios ven sus acuerdos"
  ON acuerdos_voluntades FOR SELECT USING (
    EXISTS (SELECT 1 FROM facturas f WHERE f.nit_prestador = acuerdos_voluntades.eps_codigo AND f.user_id = auth.uid())
    OR true -- TODO: restringir a prestador_id del usuario
  );

-- Tarifas de acuerdos: lectura si puede ver el acuerdo padre
DROP POLICY IF EXISTS "Usuarios ven tarifas de sus acuerdos" ON acuerdo_tarifas;
CREATE POLICY "Usuarios ven tarifas de sus acuerdos"
  ON acuerdo_tarifas FOR SELECT USING (true);

-- Acuerdos: INSERT/UPDATE/DELETE (necesarios para ConfiguracionAcuerdo)
DROP POLICY IF EXISTS "Usuarios insertan acuerdos" ON acuerdos_voluntades;
CREATE POLICY "Usuarios insertan acuerdos"
  ON acuerdos_voluntades FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios actualizan acuerdos" ON acuerdos_voluntades;
CREATE POLICY "Usuarios actualizan acuerdos"
  ON acuerdos_voluntades FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Usuarios eliminan acuerdos" ON acuerdos_voluntades;
CREATE POLICY "Usuarios eliminan acuerdos"
  ON acuerdos_voluntades FOR DELETE USING (true);

-- Tarifas: INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Usuarios insertan tarifas" ON acuerdo_tarifas;
CREATE POLICY "Usuarios insertan tarifas"
  ON acuerdo_tarifas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios actualizan tarifas" ON acuerdo_tarifas;
CREATE POLICY "Usuarios actualizan tarifas"
  ON acuerdo_tarifas FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Usuarios eliminan tarifas" ON acuerdo_tarifas;
CREATE POLICY "Usuarios eliminan tarifas"
  ON acuerdo_tarifas FOR DELETE USING (true);

-- Catálogo: lectura pública (datos normativos públicos)
-- No RLS en catalogo_causales_glosa → es referencia pública

-- Reglas de coherencia: lectura pública (datos normativos)
-- No RLS en reglas_coherencia → es referencia pública
