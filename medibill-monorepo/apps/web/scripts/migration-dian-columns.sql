-- =====================================================================
-- MIGRACIÓN: Agregar columnas DIAN a facturas
-- Integración con Matias API para facturación electrónica
-- Fecha: 2026-03-06
-- =====================================================================

-- Columnas para tracking DIAN vía Matias API
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cufe TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS estado_dian TEXT DEFAULT NULL
  CHECK (estado_dian IS NULL OR estado_dian IN (
    'pendiente', 'enviada', 'aceptada', 'rechazada'
  ));
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS track_id_dian TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_envio_dian TIMESTAMPTZ;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS respuesta_dian_json JSONB;

-- Índices para consultas por estado DIAN
CREATE INDEX IF NOT EXISTS idx_facturas_estado_dian ON facturas(estado_dian) WHERE estado_dian IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facturas_cufe ON facturas(cufe) WHERE cufe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facturas_track_id ON facturas(track_id_dian) WHERE track_id_dian IS NOT NULL;
