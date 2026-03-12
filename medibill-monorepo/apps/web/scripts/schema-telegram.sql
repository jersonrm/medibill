-- =====================================================================
-- FASE 2: Bot Telegram — Tablas de vinculación y clasificaciones
-- =====================================================================

-- 1. Vinculación Telegram ↔ Usuario Medibill
CREATE TABLE IF NOT EXISTS telegram_vinculaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_username TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_vinculaciones_user
  ON telegram_vinculaciones(user_id);

-- 2. Códigos de vinculación temporales (TTL 10 min)
CREATE TABLE IF NOT EXISTS telegram_codigos_vinculacion (
  codigo TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expira_at TIMESTAMPTZ NOT NULL,
  usado BOOLEAN DEFAULT false
);

-- 3. Clasificaciones pendientes para deep link (TTL 1h)
CREATE TABLE IF NOT EXISTS clasificaciones_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID,
  telegram_user_id BIGINT,
  resultado_json JSONB NOT NULL,
  texto_transcrito TEXT,
  documento_paciente TEXT,
  paciente_encontrado BOOLEAN DEFAULT false,
  datos_paciente JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  expira_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clasificaciones_pendientes_token
  ON clasificaciones_pendientes(token);

-- 4. Uso anónimo (3 gratis sin cuenta)
CREATE TABLE IF NOT EXISTS telegram_uso_anonimo (
  telegram_user_id BIGINT PRIMARY KEY,
  clasificaciones_usadas INT DEFAULT 0,
  primera_uso TIMESTAMPTZ DEFAULT now()
);

-- 5. Feature flag: bot_telegram en planes
ALTER TABLE planes ADD COLUMN IF NOT EXISTS bot_telegram BOOLEAN DEFAULT false;

UPDATE planes SET bot_telegram = true WHERE id IN ('profesional', 'clinica');

-- 6. RLS policies
ALTER TABLE telegram_vinculaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_codigos_vinculacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE clasificaciones_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_uso_anonimo ENABLE ROW LEVEL SECURITY;

-- Vinculaciones: usuario ve solo las suyas
CREATE POLICY "telegram_vinculaciones_select_own"
  ON telegram_vinculaciones FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "telegram_vinculaciones_delete_own"
  ON telegram_vinculaciones FOR DELETE
  USING (user_id = auth.uid());

-- Códigos vinculación: usuario ve solo los suyos
CREATE POLICY "telegram_codigos_select_own"
  ON telegram_codigos_vinculacion FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "telegram_codigos_insert_own"
  ON telegram_codigos_vinculacion FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Clasificaciones pendientes: usuario ve solo las suyas
CREATE POLICY "clasificaciones_pendientes_select_own"
  ON clasificaciones_pendientes FOR SELECT
  USING (user_id = auth.uid());

-- Service role bypasses RLS for webhook operations
