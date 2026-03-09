-- ============================================================
-- Migración: Rate Limits distribuido + Audit Log
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Idempotente: seguro de ejecutar múltiples veces
-- ============================================================

-- =====================
-- 1. RATE LIMITS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Si la tabla existía con columna "count" en vez de "hit_count", renombrar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'count'
  ) THEN
    ALTER TABLE rate_limits RENAME COLUMN "count" TO hit_count;
  END IF;
END $$;

-- RLS habilitado sin políticas = sin acceso directo (solo vía RPC)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Función atómica de rate limiting (SECURITY DEFINER para bypass de RLS)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_ms INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := NOW() - (p_window_ms || ' milliseconds')::INTERVAL;

  -- Obtener entrada existente con lock de fila
  SELECT hit_count, window_start INTO v_count, v_window_start
  FROM rate_limits WHERE key = p_key
  FOR UPDATE;

  IF NOT FOUND OR v_window_start < v_cutoff THEN
    -- Ventana nueva o expirada: upsert con hit_count=1
    INSERT INTO rate_limits (key, hit_count, window_start)
    VALUES (p_key, 1, NOW())
    ON CONFLICT (key) DO UPDATE SET hit_count = 1, window_start = NOW();
    RETURN FALSE;
  ELSE
    -- Incrementar contador
    UPDATE rate_limits SET hit_count = hit_count + 1 WHERE key = p_key;
    RETURN (v_count + 1) > p_max;
  END IF;
END;
$$;

-- Limpieza de entradas expiradas (ejecutar manualmente o via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '10 minutes';
$$;

-- =====================
-- 2. AUDIT LOG TABLE
-- =====================

-- Agregar columnas faltantes si la tabla ya existía con schema diferente
DO $$
BEGIN
  -- Crear tabla si no existe
  CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action TEXT NOT NULL DEFAULT '',
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Si la tabla existía pero le faltaba "action", agregarla
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'action'
  ) THEN
    ALTER TABLE audit_log ADD COLUMN action TEXT NOT NULL DEFAULT '';
  END IF;

  -- Si la tabla existía pero le faltaba "metadata", agregarla
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE audit_log ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas (DROP + CREATE para idempotencia)
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_log;
CREATE POLICY "Users can view own audit logs"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_log;
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
