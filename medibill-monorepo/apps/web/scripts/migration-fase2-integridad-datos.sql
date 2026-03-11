-- ============================================================================
-- FASE 2 — Integridad de Datos (Remediación Integral Auditoría Medibill)
-- ============================================================================
-- Ejecutar en Supabase SQL Editor.
-- IMPORTANTE: Ejecutar cada bloque por separado y verificar antes de continuar.
-- ============================================================================

-- ============================================================================
-- PASO PREVIO: VERIFICACIONES DE SEGURIDAD
-- Ejecutar ANTES de los ALTER para confirmar que no hay datos problemáticos.
-- ============================================================================

-- 2.1: Verificar que no hay facturas con user_id huérfano
SELECT f.id, f.num_factura, f.user_id
FROM facturas f
LEFT JOIN auth.users u ON u.id = f.user_id
WHERE u.id IS NULL;
-- ⚠️ Si retorna filas → limpiar manualmente antes de continuar

-- 2.2: Verificar que no hay perfiles con user_id NULL
SELECT COUNT(*) AS perfiles_sin_user FROM perfiles WHERE user_id IS NULL;
-- ⚠️ Debe ser 0

-- 2.3: Verificar NULLs en organizacion_id para cada tabla
SELECT 'facturas' AS tabla, COUNT(*) AS nulls FROM facturas WHERE organizacion_id IS NULL
UNION ALL
SELECT 'auditorias_rips', COUNT(*) FROM auditorias_rips WHERE organizacion_id IS NULL
UNION ALL
SELECT 'acuerdos_voluntades', COUNT(*) FROM acuerdos_voluntades WHERE organizacion_id IS NULL
UNION ALL
SELECT 'pacientes', COUNT(*) FROM pacientes WHERE organizacion_id IS NULL;
-- ⚠️ Si hay NULLs, ejecutar el backfill del paso 2.3 antes del SET NOT NULL


-- ============================================================================
-- 2.1: FK facturas.user_id → auth.users
-- Solo ejecutar si la verificación anterior retornó 0 filas.
-- ============================================================================

ALTER TABLE facturas
  ADD CONSTRAINT fk_facturas_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


-- ============================================================================
-- 2.2: perfiles.user_id NOT NULL
-- Solo ejecutar si la verificación confirmó 0 NULLs.
-- ============================================================================

ALTER TABLE perfiles ALTER COLUMN user_id SET NOT NULL;


-- ============================================================================
-- 2.3: Backfill organizacion_id NULLs + SET NOT NULL
-- Ejecutar backfills primero, verificar 0 NULLs, luego SET NOT NULL.
-- ============================================================================

-- Backfill facturas
UPDATE facturas f
SET organizacion_id = (
  SELECT p.organizacion_id FROM perfiles p WHERE p.user_id = f.user_id LIMIT 1
)
WHERE f.organizacion_id IS NULL;

-- Backfill auditorias_rips
UPDATE auditorias_rips ar
SET organizacion_id = (
  SELECT p.organizacion_id FROM perfiles p WHERE p.user_id = ar.user_id LIMIT 1
)
WHERE ar.organizacion_id IS NULL;

-- acuerdos_voluntades: NO tiene columna user_id, pero verificación previa
-- confirmó 0 NULLs en organizacion_id, así que no requiere backfill.

-- Backfill pacientes
UPDATE pacientes pa
SET organizacion_id = (
  SELECT p.organizacion_id FROM perfiles p WHERE p.user_id = pa.user_id LIMIT 1
)
WHERE pa.organizacion_id IS NULL;

-- Verificar 0 NULLs restantes (re-ejecutar la query del paso previo)
-- Luego aplicar NOT NULL:

ALTER TABLE facturas ALTER COLUMN organizacion_id SET NOT NULL;
ALTER TABLE auditorias_rips ALTER COLUMN organizacion_id SET NOT NULL;
ALTER TABLE acuerdos_voluntades ALTER COLUMN organizacion_id SET NOT NULL;
ALTER TABLE pacientes ALTER COLUMN organizacion_id SET NOT NULL;


-- ============================================================================
-- 2.4 (SQL): Migrar datos de columna `action` → `accion` y DROP
-- ⚠️ Ejecutar DESPUÉS de migrar el código (Steps 8-9 en el plan).
-- ============================================================================

-- Migrar datos: copiar `action` a `accion` donde `accion` está vacía/NULL
UPDATE audit_log
SET accion = action,
    tabla = CASE
      WHEN action IN ('rate_limit_exceeded') THEN 'rate_limits'
      ELSE COALESCE(tabla, 'sistema')
    END
WHERE (accion = '' OR accion IS NULL)
  AND action IS NOT NULL
  AND action != '';

-- Verificar que no quedan registros con `action` pero sin `accion`:
SELECT COUNT(*) AS pendientes
FROM audit_log
WHERE (accion = '' OR accion IS NULL)
  AND action IS NOT NULL AND action != '';
-- ⚠️ Debe ser 0

-- DROP columna sobrante
ALTER TABLE audit_log DROP COLUMN IF EXISTS action;


-- ============================================================================
-- 2.5: Trigger genérico updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a tablas que tienen columna updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'facturas', 'acuerdos_voluntades', 'credenciales_muv',
      'mapeos_sabana_eps', 'pacientes', 'perfiles', 'suscripciones',
      'pagos', 'respuestas_glosas', 'organizaciones'
    ])
  LOOP
    -- Drop si ya existe (idempotente)
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;


-- ============================================================================
-- 2.7: Índices faltantes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_auditorias_rips_user ON auditorias_rips(user_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_org ON perfiles(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_facturas_org_estado ON facturas(organizacion_id, estado);
CREATE INDEX IF NOT EXISTS idx_facturas_user_estado ON facturas(user_id, estado);


-- ============================================================================
-- 2.8 (SQL): UNIQUE constraint para idempotencia Wompi
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_historial_wompi_tx
  ON historial_pagos(wompi_transaction_id)
  WHERE wompi_transaction_id IS NOT NULL;


-- ============================================================================
-- 2.9: Policies duplicadas en perfiles
-- ============================================================================
-- 9 policies detectadas (3 por operación). Mantener "Usuarios..." (consistente
-- con el resto del codebase), eliminar "Medicos..." (legacy) y "Users can..." (English).
--
-- Mantener:
--   "Usuarios ven su perfil" (SELECT)
--   "Usuarios insertan su perfil" (INSERT)
--   "Usuarios actualizan su perfil" (UPDATE)

DROP POLICY IF EXISTS "Medicos ven su propio perfil" ON perfiles;
DROP POLICY IF EXISTS "Medicos actualizan su propio perfil" ON perfiles;
DROP POLICY IF EXISTS "Medicos insertan su propio perfil" ON perfiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON perfiles;
DROP POLICY IF EXISTS "Users can read own profile" ON perfiles;
DROP POLICY IF EXISTS "Users can update own profile" ON perfiles;


-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- FK funciona:
-- INSERT INTO facturas (user_id, ...) VALUES ('00000000-0000-0000-0000-000000000000', ...) → error FK

-- NOT NULL funciona:
-- INSERT INTO perfiles (user_id) VALUES (NULL) → error NOT NULL

-- Triggers funcionan:
-- UPDATE facturas SET estado = estado WHERE id = (SELECT id FROM facturas LIMIT 1);
-- Verificar que updated_at cambió

-- Índices creados:
SELECT indexname FROM pg_indexes
WHERE tablename IN ('facturas', 'auditorias_rips', 'perfiles', 'historial_pagos')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Columna `action` eliminada:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'audit_log' AND column_name = 'action';
-- ⚠️ Debe retornar 0 filas
