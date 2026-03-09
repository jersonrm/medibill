-- Migración: Soporte para eliminación de cuenta con período de gracia 7 días
-- Ejecutar en Supabase SQL Editor

ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS eliminacion_programada_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN perfiles.eliminacion_programada_at IS 'Fecha en que el usuario solicitó eliminar su cuenta. Tras 7 días, un cron purga los datos.';
