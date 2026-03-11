-- MIGRATION: Add soft-delete column to servicios_medico
-- Run in Supabase SQL Editor before deploying code changes

ALTER TABLE servicios_medico
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN servicios_medico.activo IS 'Soft delete flag — false means logically deleted';

-- Index to support filtered queries
CREATE INDEX IF NOT EXISTS idx_servicios_medico_activo
  ON servicios_medico (usuario_id, activo) WHERE activo = TRUE;
