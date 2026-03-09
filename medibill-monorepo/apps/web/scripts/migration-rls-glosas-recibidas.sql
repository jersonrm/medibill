-- =====================================================================
-- MIGRACIÓN: RLS para glosas_recibidas y respuestas_glosas
-- Medibill — Auditoría de seguridad Fase 4
--
-- Problema detectado:
--   1. glosas_recibidas está UNRESTRICTED — contiene datos privados
--      por usuario (glosas, valores, pacientes).
--   2. respuestas_glosas tiene RLS habilitado pero SIN políticas,
--      y le falta la columna user_id que el código espera.
--
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 1: Columna user_id + RLS para glosas_recibidas
-- ─────────────────────────────────────────────────────────────────────

-- 1.1 Agregar columna user_id (no existe aún en la tabla)
ALTER TABLE glosas_recibidas
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 1.2 Backfill: copiar user_id desde facturas para registros existentes
UPDATE glosas_recibidas gr
SET user_id = f.user_id
FROM facturas f
WHERE gr.factura_id = f.id
  AND gr.user_id IS NULL;

-- 1.3 Hacer NOT NULL después del backfill
ALTER TABLE glosas_recibidas
  ALTER COLUMN user_id SET NOT NULL;

-- 1.4 Índice para rendimiento
CREATE INDEX IF NOT EXISTS idx_glosas_recibidas_user ON glosas_recibidas(user_id);

-- 1.5 Habilitar RLS
ALTER TABLE glosas_recibidas ENABLE ROW LEVEL SECURITY;

-- 1.6 Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Usuarios ven sus glosas recibidas" ON glosas_recibidas;
DROP POLICY IF EXISTS "Usuarios insertan sus glosas recibidas" ON glosas_recibidas;
DROP POLICY IF EXISTS "Usuarios actualizan sus glosas recibidas" ON glosas_recibidas;
DROP POLICY IF EXISTS "Usuarios eliminan sus glosas recibidas" ON glosas_recibidas;

-- 1.7 Políticas CRUD directas por user_id
CREATE POLICY "Usuarios ven sus glosas recibidas"
  ON glosas_recibidas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios insertan sus glosas recibidas"
  ON glosas_recibidas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus glosas recibidas"
  ON glosas_recibidas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus glosas recibidas"
  ON glosas_recibidas FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 2: Columna user_id + RLS para respuestas_glosas
-- ─────────────────────────────────────────────────────────────────────

-- 2.1 Agregar columna user_id si no existe
-- (El código filtra por user_id pero la migración original no la creó)
ALTER TABLE respuestas_glosas
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2.2 Backfill: copiar user_id desde glosas_recibidas para registros existentes
UPDATE respuestas_glosas rg
SET user_id = gr.user_id
FROM glosas_recibidas gr
WHERE rg.glosa_id = gr.id
  AND rg.user_id IS NULL;

-- 2.3 Hacer NOT NULL después del backfill
ALTER TABLE respuestas_glosas
  ALTER COLUMN user_id SET NOT NULL;

-- 2.4 Índice para rendimiento en filtros por user_id
CREATE INDEX IF NOT EXISTS idx_resp_glosas_user ON respuestas_glosas(user_id);

-- 2.5 Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Usuarios ven sus respuestas" ON respuestas_glosas;
DROP POLICY IF EXISTS "Usuarios insertan respuestas" ON respuestas_glosas;
DROP POLICY IF EXISTS "Usuarios actualizan respuestas" ON respuestas_glosas;
DROP POLICY IF EXISTS "Usuarios eliminan respuestas" ON respuestas_glosas;

-- 2.6 Políticas CRUD directas por user_id
-- (RLS ya debería estar habilitado — el usuario lo hizo manualmente)
ALTER TABLE respuestas_glosas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus respuestas"
  ON respuestas_glosas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios insertan respuestas"
  ON respuestas_glosas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan respuestas"
  ON respuestas_glosas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan respuestas"
  ON respuestas_glosas FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────────────

-- Ejecutar después de la migración para confirmar:

-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('glosas_recibidas', 'respuestas_glosas');
-- Esperado: ambas con rowsecurity = true

-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('glosas_recibidas', 'respuestas_glosas')
-- ORDER BY tablename, cmd;
-- Esperado: 4 políticas por tabla (SELECT, INSERT, UPDATE, DELETE)
