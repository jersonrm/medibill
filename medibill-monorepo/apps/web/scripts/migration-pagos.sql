-- ============================================================
-- Migración: Módulo de Pagos (Seguimiento básico)
-- Fecha: 2026-03-06
-- ============================================================

-- 1. Tabla de pagos
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monto NUMERIC(18,2) NOT NULL CHECK (monto > 0),
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('transferencia', 'cheque', 'efectivo', 'consignacion', 'compensacion', 'otro')),
  referencia TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_pagos_factura_id ON pagos(factura_id);
CREATE INDEX IF NOT EXISTS idx_pagos_user_id ON pagos(user_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago);

-- 3. RLS (Row Level Security)
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pagos"
  ON pagos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pagos"
  ON pagos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pagos"
  ON pagos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pagos"
  ON pagos FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Agregar estado 'pagada_parcial' al flujo de facturas (el estado 'pagada' ya existe en el check constraint)
-- Verificar si el constraint actual permite los nuevos estados
DO $$
BEGIN
  -- Intentar agregar 'pagada_parcial' al estados válidos si hay un constraint
  -- Si no existe constraint, simplemente usar los valores desde el código
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'facturas' AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%estado%'
  ) THEN
    -- Eliminar el constraint viejo y crear uno nuevo con los estados adicionales
    EXECUTE (
      SELECT 'ALTER TABLE facturas DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'facturas' AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%estado%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE facturas ADD CONSTRAINT facturas_estado_check
  CHECK (estado IN (
    'borrador', 'aprobada', 'descargada', 'radicada', 'anulada',
    'devuelta', 'glosada', 'respondida', 'conciliada',
    'pagada', 'pagada_parcial'
  ));
