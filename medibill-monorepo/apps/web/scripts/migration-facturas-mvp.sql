-- ============================================================
-- Migración: Alinear tabla facturas con el MVP v1.0
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Expandir CHECK constraint de estado para incluir estados del MVP
ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_estado_check;
ALTER TABLE facturas ADD CONSTRAINT facturas_estado_check
  CHECK (estado IN (
    'borrador','aprobada','descargada','anulada',
    'radicada','devuelta','glosada','respondida','conciliada','pagada'
  ));

-- 2. Agregar columnas faltantes que usa el MVP
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(18,2) DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS copago          NUMERIC(18,2) DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cuota_moderadora NUMERIC(18,2) DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS descuentos      NUMERIC(18,2) DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS diagnosticos    JSONB DEFAULT '[]';
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS procedimientos  JSONB DEFAULT '[]';
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS paciente_id     UUID REFERENCES pacientes(id);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS resolucion_id   UUID;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS perfil_prestador_snapshot JSONB;
