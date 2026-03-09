-- =====================================================================
-- SCHEMA: Audit Log — Medibill
-- Registro de auditoría para acciones críticas del sistema
-- Base de datos: Supabase (PostgreSQL 15+)
-- Fecha: 2026-03-06
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  accion      TEXT NOT NULL,          -- 'crear_factura', 'aprobar_factura', 'generar_fev', etc.
  tabla       TEXT NOT NULL,           -- 'facturas', 'acuerdos_voluntades', etc.
  registro_id UUID,                    -- ID del registro afectado (nullable para acciones sin registro)
  metadata    JSONB DEFAULT '{}',      -- Datos adicionales (valores anteriores, nuevos, etc.)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_log_user       ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabla       ON audit_log(tabla);
CREATE INDEX IF NOT EXISTS idx_audit_log_created     ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro    ON audit_log(registro_id);

-- RLS: cada usuario solo ve su propio audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven su audit log" ON audit_log;
CREATE POLICY "Usuarios ven su audit log"
  ON audit_log FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan su audit log" ON audit_log;
CREATE POLICY "Usuarios insertan su audit log"
  ON audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No se permite UPDATE ni DELETE en audit_log (inmutable)
