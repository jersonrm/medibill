-- ============================================================================
-- Procedimiento: Rotar Service Role Key (SEC-001)
-- Fecha: 2026-03-11
-- NOTA: Este archivo NO es una migración SQL ejecutable.
--       Es documentación del procedimiento manual de rotación.
-- ============================================================================

-- PROBLEMA:
-- La SUPABASE_SERVICE_ROLE_KEY está expuesta en .env.local del workspace
-- (JWT completo visible en resultados de auditoría de seguridad).

-- PROCEDIMIENTO:

-- PASO 1: Regenerar la key en Supabase
--   1. Ir a https://supabase.com/dashboard → seleccionar proyecto
--   2. Settings → API
--   3. En la sección "Project API keys", buscar "service_role" (secret)
--   4. Click "Generate a new key" o el botón de regenerar
--   5. Copiar la nueva key

-- PASO 2: Actualizar .env.local
--   1. Abrir .env.local en el directorio apps/web/
--   2. Reemplazar el valor de SUPABASE_SERVICE_ROLE_KEY con la nueva key
--   3. Guardar el archivo
--   ⚠️  NO commitear .env.local al repositorio

-- PASO 3: Actualizar Vercel
--   1. Ir a https://vercel.com → proyecto Medibill
--   2. Settings → Environment Variables
--   3. Buscar SUPABASE_SERVICE_ROLE_KEY
--   4. Editar → pegar la nueva key
--   5. Verificar que aplica a: Production, Preview, Development
--   6. Guardar

-- PASO 4: Redesplegar
--   1. En Vercel → Deployments → último deploy → Redeploy
--   2. O hacer push de cualquier cambio para triggear un nuevo deploy

-- PASO 5: Verificación post-rotación
--   [ ] Login funciona normalmente
--   [ ] Crear factura borrador funciona
--   [ ] Webhook Wompi responde (test desde Wompi dashboard)
--   [ ] Bot Telegram responde a un audio de prueba
--   [ ] Cron jobs ejecutan sin error (Vercel → Functions → Cron logs)
--   [ ] Página /admin funciona (si aplica)

-- ROLLBACK:
-- Si algo falla inmediatamente después de la rotación:
--   1. La key anterior YA NO funciona (Supabase la invalida al regenerar)
--   2. Si hay problemas: verificar que la nueva key en Vercel y .env.local
--      coincide exactamente con la que muestra Supabase Dashboard
--   3. Si la key se copió mal: ir a Supabase Dashboard y copiarla de nuevo
