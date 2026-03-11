-- ============================================================================
-- Migración: Revocar permisos excesivos del rol anon (SEC-002)
-- Fecha: 2026-03-11
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- 
-- CONTEXTO:
-- El rol anon tiene ALL (SELECT, INSERT, UPDATE, DELETE, TRUNCATE) en 30+
-- tablas. En la práctica, NINGUNA query de la app usa el rol anon contra
-- tablas — todas las queries ocurren post-login (rol authenticated) o vía
-- service_role (webhooks, cron). Login/signup usan la API GoTrue de Supabase
-- (no queries a tablas).
--
-- La ÚNICA tabla que anon necesita leer es `planes` (catálogo público de
-- precios, policy USING(true)).
--
-- Impacto: NINGUNO en la app.
--   - Middleware: queries post-getUser() usan JWT → rol authenticated
--   - Login/Signup: usan auth.signInWithPassword/signUp (API GoTrue, no tablas)
--   - Server actions: todas post-login → rol authenticated
--   - Telegram/Cron/Wompi: usan service_role vía createServiceClient()
--   - Landing page: estática, sin Supabase
--
-- Rollback: GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
-- ============================================================================

BEGIN;

-- 1. Revocar TODOS los permisos de anon en TODAS las tablas del schema public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- 2. Re-conceder SOLO lo estrictamente necesario:
--    planes (catálogo de precios) — tiene policy planes_select USING(true)
GRANT SELECT ON public.planes TO anon;

-- 3. Verificación pre-COMMIT
-- Resultado esperado: EXACTAMENTE 1 fila → (anon, planes, SELECT)
-- Si aparecen más filas o cero filas: ejecutar ROLLBACK en vez de COMMIT
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-EJECUCIÓN (ejecutar después para confirmar)
-- ============================================================================
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'anon'
--   AND table_schema = 'public'
-- ORDER BY table_name, privilege_type;
-- Resultado esperado: solo (anon, planes, SELECT)

-- ============================================================================
-- PRUEBA DE HUMO (opcional, ejecutar como rol anon)
-- ============================================================================
-- SET ROLE anon;
-- SELECT count(*) FROM planes;          -- ✅ debe funcionar
-- SELECT count(*) FROM facturas;        -- ❌ debe dar permission denied
-- SELECT count(*) FROM perfiles;        -- ❌ debe dar permission denied
-- RESET ROLE;

-- ============================================================================
-- ROLLBACK (ejecutar solo si es necesario revertir)
-- ============================================================================
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
