-- ============================================================================
-- Migración: FORCE ROW LEVEL SECURITY en todas las tablas con RLS (SEC-004)
-- Fecha: 2026-03-11
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Impacto: NINGUNO en la app — solo afecta conexiones directas como el rol
--          postgres (table owner). Los roles authenticated, anon y service_role
--          NO se ven afectados (service_role tiene atributo bypassrls).
-- Rollback: Ejecutar el bloque de rollback al final de este archivo.
-- ============================================================================

-- Enfoque dinámico: encuentra TODAS las tablas en schema public que tienen
-- RLS habilitado (relrowsecurity=true) pero NO forzado (relforcerowsecurity=false)
-- y les aplica FORCE RLS. Así no dependemos de una lista hardcodeada.
DO $$
DECLARE
  tbl RECORD;
  tablas_actualizadas INT := 0;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'          -- solo tablas regulares
      AND c.relrowsecurity = true  -- RLS habilitado
      AND c.relforcerowsecurity = false  -- aún no forzado
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl.relname);
    RAISE NOTICE 'FORCE RLS activado en: %', tbl.relname;
    tablas_actualizadas := tablas_actualizadas + 1;
  END LOOP;

  RAISE NOTICE '✅ Total tablas con FORCE RLS activado: %', tablas_actualizadas;
END;
$$;

-- ============================================================================
-- VERIFICACIÓN POST-EJECUCIÓN (ejecutar después para confirmar)
-- Resultado esperado: TODAS las tablas con relrowsecurity=true deben tener
--                     relforcerowsecurity=true
-- ============================================================================
-- SELECT c.relname AS tabla,
--        c.relrowsecurity AS rls_habilitado,
--        c.relforcerowsecurity AS rls_forzado
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
--   AND c.relrowsecurity = true
-- ORDER BY c.relname;

-- ============================================================================
-- ROLLBACK (ejecutar solo si es necesario revertir)
-- ============================================================================
-- DO $$
-- DECLARE
--   tbl RECORD;
-- BEGIN
--   FOR tbl IN
--     SELECT c.relname
--     FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public'
--       AND c.relkind = 'r'
--       AND c.relforcerowsecurity = true
--     ORDER BY c.relname
--   LOOP
--     EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', tbl.relname);
--     RAISE NOTICE 'FORCE RLS revertido en: %', tbl.relname;
--   END LOOP;
-- END;
-- $$;
