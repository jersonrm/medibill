-- ============================================================
-- Migración: Importación inteligente de sábanas EPS
-- Fecha: 2026-03-06
-- Tablas: mapeos_sabana_eps, importaciones_sabana
-- ============================================================

-- 1. Tabla de mapeos de columnas por EPS (cache para evitar re-llamar al LLM)
CREATE TABLE IF NOT EXISTS mapeos_sabana_eps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nit_eps TEXT NOT NULL,
  eps_nombre TEXT NOT NULL,
  headers_hash TEXT NOT NULL,
  mapeo_json JSONB NOT NULL,
  confianza NUMERIC(3,2) NOT NULL DEFAULT 0,
  veces_usado INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, nit_eps, headers_hash)
);

-- 2. Índices para mapeos
CREATE INDEX IF NOT EXISTS idx_mapeos_sabana_user ON mapeos_sabana_eps(user_id);
CREATE INDEX IF NOT EXISTS idx_mapeos_sabana_eps ON mapeos_sabana_eps(user_id, nit_eps);

-- 3. RLS para mapeos
ALTER TABLE mapeos_sabana_eps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mapeos"
  ON mapeos_sabana_eps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mapeos"
  ON mapeos_sabana_eps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mapeos"
  ON mapeos_sabana_eps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mapeos"
  ON mapeos_sabana_eps FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Tabla de importaciones (auditoría y trazabilidad)
CREATE TABLE IF NOT EXISTS importaciones_sabana (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nit_eps TEXT NOT NULL,
  eps_nombre TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  total_filas INTEGER NOT NULL DEFAULT 0,
  filas_conciliadas INTEGER NOT NULL DEFAULT 0,
  filas_sin_match INTEGER NOT NULL DEFAULT 0,
  monto_total_importado NUMERIC(18,2) NOT NULL DEFAULT 0,
  monto_total_glosado NUMERIC(18,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada')),
  mapeo_usado_id UUID REFERENCES mapeos_sabana_eps(id) ON DELETE SET NULL,
  resumen_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Índices para importaciones
CREATE INDEX IF NOT EXISTS idx_importaciones_user ON importaciones_sabana(user_id);
CREATE INDEX IF NOT EXISTS idx_importaciones_fecha ON importaciones_sabana(created_at DESC);

-- 6. RLS para importaciones
ALTER TABLE importaciones_sabana ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own importaciones"
  ON importaciones_sabana FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own importaciones"
  ON importaciones_sabana FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own importaciones"
  ON importaciones_sabana FOR UPDATE
  USING (auth.uid() = user_id);
