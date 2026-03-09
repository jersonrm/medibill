-- =====================================================================
-- MIGRACIÓN: Agregar columnas MUV (MinSalud) a facturas
-- Integración con Mecanismo Único de Validación para obtener CUV
-- Fecha: 2026-03-06
-- =====================================================================

-- Columnas para tracking MUV (Ministerio de Salud)
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cuv TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS estado_muv TEXT DEFAULT NULL
  CHECK (estado_muv IS NULL OR estado_muv IN (
    'pendiente', 'validando', 'validado', 'rechazado'
  ));
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_envio_muv TIMESTAMPTZ;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS respuesta_muv_json JSONB;

-- Índices para consultas por estado MUV
CREATE INDEX IF NOT EXISTS idx_facturas_cuv ON facturas(cuv) WHERE cuv IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facturas_estado_muv ON facturas(estado_muv) WHERE estado_muv IS NOT NULL;
