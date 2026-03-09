-- ============================================================
-- Migration: Tabla de autorizaciones para validación de vigencia
-- Vinculada a validador-glosas.ts → validarVigenciaAutorizacion()
-- ============================================================

CREATE TABLE IF NOT EXISTS autorizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factura_id UUID REFERENCES facturas(id) ON DELETE SET NULL,
  numero_autorizacion TEXT NOT NULL,
  eps_nit TEXT NOT NULL,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'vencida', 'anulada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsqueda rápida por usuario + número de autorización
CREATE INDEX IF NOT EXISTS idx_autorizaciones_user_numero
  ON autorizaciones (user_id, numero_autorizacion);

-- RLS
ALTER TABLE autorizaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus autorizaciones" ON autorizaciones;
CREATE POLICY "Usuarios ven sus autorizaciones"
  ON autorizaciones FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan sus autorizaciones" ON autorizaciones;
CREATE POLICY "Usuarios insertan sus autorizaciones"
  ON autorizaciones FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus autorizaciones" ON autorizaciones;
CREATE POLICY "Usuarios actualizan sus autorizaciones"
  ON autorizaciones FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios eliminan sus autorizaciones" ON autorizaciones;
CREATE POLICY "Usuarios eliminan sus autorizaciones"
  ON autorizaciones FOR DELETE USING (auth.uid() = user_id);
