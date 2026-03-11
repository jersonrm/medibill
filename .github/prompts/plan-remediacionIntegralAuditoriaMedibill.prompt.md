# Plan: Remediación Integral — Auditoría Medibill

**TL;DR:** Remediar **las 65 fallas** detectadas en los 6 reportes de auditoría (Seguridad, Funcional, DB, Código, Integraciones, Production Readiness), organizadas en **6 fases** por severidad. Las primeras 2 fases cubren vulnerabilidades de seguridad activas. Cada hallazgo fue verificado contra el código fuente real.

---

## Inventario Consolidado de Hallazgos (deduplicado de 6 reportes)

| Severidad | Cantidad |
|-----------|----------|
| CRITICAL  | 12       |
| HIGH      | 11       |
| MEDIUM    | 16       |
| LOW       | 8        |
| Mejoras   | 18       |
| **Total** | **65**   |

---

## FASE 0 — Seguridad de Base de Datos (CRÍTICA — ejecutar primero)

> Prerequisito: Acceso SQL Editor Supabase. Riesgo si no se ejecuta: exposición de datos a usuarios no autenticados.

| # | Hallazgo | Severidad | Qué hacer |
|---|----------|-----------|-----------|
| 0.1 | 4 tablas sin RLS expuestas a `anon` con permisos de escritura (`catalogo_causales_glosa`, `cups_alias`, `cups_categorias`, `reglas_coherencia`) | CRITICAL | Habilitar RLS + crear policy SELECT para `authenticated` + REVOKE INSERT/UPDATE/DELETE de `anon` y `authenticated` |
| 0.2 | `acuerdo_tarifas` y `acuerdos_voluntades` tienen SELECT `USING=true` — cualquier usuario ve datos de TODOS los tenants | CRITICAL | DROP policies abiertas, reemplazar con filtro por `get_user_org_id()` |
| 0.3 | `audit_log` INSERT permite insertar con `user_id` ajeno (suplantación) | CRITICAL | DROP policy permisiva, crear `WITH CHECK (auth.uid() = user_id)` |
| 0.4 | 5 funciones SECURITY DEFINER sin `SET search_path` (`get_user_org_id`, `user_has_role`, `incrementar_uso_mensual`, `siguiente_numero_factura`, `refresh_benchmark_views`) | HIGH | Recrear con `SET search_path = 'public'` |
| 0.5 | `organizaciones.nit` sin UNIQUE constraint | HIGH | `CREATE UNIQUE INDEX ... WHERE nit IS NOT NULL` |
| 0.6 | Sin CHECK para valores monetarios no-negativos en `facturas`, `glosas_recibidas` | HIGH | ALTER TABLE ADD CONSTRAINT CHECK (≥ 0) |
| 0.7 | Sin CHECK `rango_desde <= rango_hasta` en `resoluciones_facturacion` | MEDIUM | ALTER TABLE ADD CONSTRAINT |

### SQL de Remediación — Fase 0

```sql
-- 0.1: Proteger tablas sin RLS
ALTER TABLE catalogo_causales_glosa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalogo_select_auth" ON catalogo_causales_glosa FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON catalogo_causales_glosa FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON catalogo_causales_glosa FROM authenticated;

ALTER TABLE cups_alias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cups_alias_select_auth" ON cups_alias FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON cups_alias FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON cups_alias FROM authenticated;

ALTER TABLE cups_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cups_categorias_select_auth" ON cups_categorias FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON cups_categorias FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON cups_categorias FROM authenticated;

ALTER TABLE reglas_coherencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reglas_select_auth" ON reglas_coherencia FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON reglas_coherencia FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON reglas_coherencia FROM authenticated;

-- 0.2: Fijar policies USING=true
DROP POLICY IF EXISTS "Usuarios ven tarifas de sus acuerdos" ON acuerdo_tarifas;
CREATE POLICY "Usuarios ven tarifas de sus acuerdos" ON acuerdo_tarifas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM acuerdos_voluntades av
      WHERE av.id = acuerdo_tarifas.acuerdo_id
      AND av.organizacion_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Usuarios ven sus acuerdos" ON acuerdos_voluntades;
CREATE POLICY "Usuarios ven sus acuerdos" ON acuerdos_voluntades
  FOR SELECT USING (organizacion_id = get_user_org_id());

DROP POLICY IF EXISTS "Lectura publica plazos" ON auditoria_plazos;

-- 0.3: Fijar audit_log INSERT
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_log;
CREATE POLICY "Authenticated users can insert audit logs" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 0.4: SET search_path en SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$ SELECT organizacion_id FROM usuarios_organizacion
     WHERE user_id = auth.uid() AND activo = true LIMIT 1; $$;

-- Repetir patrón para: user_has_role, incrementar_uso_mensual,
-- siguiente_numero_factura, refresh_benchmark_views

-- 0.5: UNIQUE en organizaciones.nit
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_nit_unique
  ON organizaciones(nit) WHERE nit IS NOT NULL;

-- 0.6: CHECK constraints monetarios
ALTER TABLE facturas ADD CONSTRAINT chk_valor_total_no_neg CHECK (valor_total >= 0);
ALTER TABLE facturas ADD CONSTRAINT chk_subtotal_no_neg CHECK (subtotal >= 0);
ALTER TABLE facturas ADD CONSTRAINT chk_copago_no_neg CHECK (copago >= 0);
ALTER TABLE facturas ADD CONSTRAINT chk_cuota_mod_no_neg CHECK (cuota_moderadora >= 0);
ALTER TABLE facturas ADD CONSTRAINT chk_descuentos_no_neg CHECK (descuentos >= 0);
-- Repetir para glosas_recibidas: valor_glosado >= 0, valor_factura >= 0

-- 0.7: CHECK rango resoluciones
ALTER TABLE resoluciones_facturacion
  ADD CONSTRAINT chk_rango_valido CHECK (rango_desde <= rango_hasta);
```

**Verificación:** Intentar INSERT con anon key → 403; query cross-tenant → solo datos propios.

---

## FASE 1 — Seguridad de Aplicación (CRÍTICA)

> Riesgo si no se ejecuta: bypass de roles RBAC, inyección de datos corruptos, webhook forgery.

| # | Hallazgo | Severidad | Archivos clave | Qué hacer |
|---|----------|-----------|----------------|-----------|
| 1.1 | **RBAC no enforced** en ~12 server actions (facturas, dian, clasificación, acuerdos, glosas, perfil, pagos, muv, radicación, conciliación) | CRITICAL | `app/actions/facturas.ts` L155, `app/actions/dian.ts` L16, `app/actions/clasificacion.ts` L156, `app/actions/acuerdos.ts` L55, + 8 más | Agregar `verificarPermisoOError(ctx.rol, "permiso")` al inicio de cada server action con mutación |
| 1.2 | **Sin validación de schemas** server-side (no Zod/Yup) — datos corruptos posibles | CRITICAL | Todas las server actions | Instalar Zod, crear schemas en `lib/schemas/`, parsear input en cada action. Incluye fix mass assignment en `app/actions/perfil.ts` L23 y validación `monto > 0` en `app/actions/pagos.ts` L69 |
| 1.3 | **Telegram webhook sin secret_token** — cualquiera puede enviar updates falsos | CRITICAL | `app/api/telegram/webhook/route.ts` L40 | Agregar `TELEGRAM_WEBHOOK_SECRET` env var, validar header `X-Telegram-Bot-Api-Secret-Token` |
| 1.4 | MIME type basado en client (spoofable) en file uploads | MEDIUM | `app/actions/respuesta-glosas.ts` L672, `app/actions/conciliacion.ts` L53 | Validar magic bytes del archivo |
| 1.5 | Sin rate limiting en server actions costosas (clasificación IA, envío DIAN) | MEDIUM | `app/actions/clasificacion.ts`, `app/actions/dian.ts` | Rate limiter por userId usando patrón de `lib/rate-limit.ts` |
| 1.6 | Auth pattern inconsistente (3 variantes: `getUser()`, `requireUser()`, `getContextoOrg()`) | MEDIUM | `acuerdos.ts`, `dashboard.ts`, `conciliacion.ts`, `benchmarks.ts`, `busqueda-codigos.ts` | Migrar TODO a `getContextoOrg()` para tener rol disponible |

### Detalle de implementación — 1.1 RBAC

Archivos a modificar con el permiso requerido según `lib/permisos.ts`:

| Archivo | Función | Permiso RBAC |
|---------|---------|--------------|
| `app/actions/facturas.ts` | `crearFacturaBorrador` | `crear_factura` |
| `app/actions/facturas.ts` | `aprobarFactura` | `aprobar_factura` |
| `app/actions/facturas.ts` | `anularFactura` | `anular_factura` |
| `app/actions/facturas.ts` | `editarFacturaBorrador` | `crear_factura` |
| `app/actions/dian.ts` | `enviarFacturaDian` | `enviar_dian` |
| `app/actions/dian.ts` | `consultarEstadoDian` | `enviar_dian` |
| `app/actions/clasificacion.ts` | `clasificarTextoMedico` | `clasificar_ia` |
| `app/actions/acuerdos.ts` | `guardarAcuerdo` | `gestionar_acuerdos` |
| `app/actions/acuerdos.ts` | `eliminarAcuerdo` | `gestionar_acuerdos` |
| `app/actions/respuesta-glosas.ts` | `registrarRespuestaGlosa` | `responder_glosa` |
| `app/actions/conciliacion.ts` | todas | `importar_sabana` |
| `app/actions/perfil.ts` | `guardarPerfil`, `guardarResolucion` | `config_organizacion` |
| `app/actions/muv.ts` | `validarRipsYObtenerCuv` | `enviar_dian` |
| `app/actions/radicacion.ts` | todas | `crear_factura` |
| `app/actions/pagos.ts` | `registrarPago` | `crear_factura` |

Patrón a aplicar en cada función:

```ts
const ctx = await getContextoOrg();
verificarPermisoOError(ctx.rol, "nombre_permiso");
```

### Detalle de implementación — 1.2 Zod Schemas

1. `pnpm add zod` en `apps/web`
2. Crear `lib/schemas/` con:
   - `facturas.schema.ts` — CrearFacturaInput, EditarFacturaInput
   - `perfil.schema.ts` — GuardarPerfilInput (**whitelist** campos permitidos, NO spread)
   - `pacientes.schema.ts` — PacienteInput
   - `pagos.schema.ts` — RegistrarPagoInput (`monto: z.number().positive()`)
   - `acuerdos.schema.ts` — GuardarAcuerdoInput
   - `glosas.schema.ts` — RegistrarRespuestaInput (`justificacion: z.string().min(20)`)
   - `dian.schema.ts` — EnviarDianInput
   - `equipo.schema.ts` — InvitarUsuarioInput (email format, rol enum)

3. En cada server action:
```ts
const parsed = CrearFacturaSchema.safeParse(input);
if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
const validInput = parsed.data;
```

4. Fix mass assignment en `perfil.ts`:
```ts
// ANTES (inseguro):
const payload = { ...datos, id: user.id, ... };

// DESPUÉS (seguro):
const { razon_social, nombre_comercial, telefono, email_facturacion, ... } = parsed.data;
const payload = { razon_social, nombre_comercial, telefono, email_facturacion, ..., id: user.id, ... };
```

**Verificación:** Test: llamar `aprobarFactura()` con rol `auditor` → error RBAC; enviar `valor_total: -500` → error Zod.

---

## FASE 2 — Integridad de Datos (*paralelo con Fase 1*)

| # | Hallazgo | Severidad | Qué hacer |
|---|----------|-----------|-----------|
| 2.1 | `facturas.user_id` sin FK a `auth.users` — huérfanos posibles | HIGH | Verificar 0 huérfanos, luego `ALTER TABLE ADD CONSTRAINT FK ... ON DELETE RESTRICT` |
| 2.2 | `perfiles.user_id` permite NULL (columna RLS) | HIGH | Verificar 0 NULLs, `ALTER COLUMN SET NOT NULL` |
| 2.3 | `facturas.organizacion_id` permite NULL (multi-tenant) | HIGH | Backfill NULLs desde perfiles, luego SET NOT NULL. Repetir para `auditorias_rips`, `acuerdos_voluntades`, `pacientes` |
| 2.4 | `audit_log` tiene columnas duplicadas (`accion` + `action`) | HIGH | Migrar datos, unificar código (`logAudit` + `registrarAuditLog` → una sola), DROP columna sobrante |
| 2.5 | Solo 1 de 10+ tablas tiene trigger `update_updated_at` | MEDIUM | Crear trigger genérico, aplicar a 10 tablas |
| 2.6 | `organizaciones.tipo` CHECK incluye `'ips'` pero TypeScript no | MEDIUM | Agregar `"ips"` al tipo TS |
| 2.7 | Índices faltantes: `auditorias_rips(user_id)`, `perfiles(organizacion_id)`, `facturas(organizacion_id, estado)` | MEDIUM | CREATE INDEX |
| 2.8 | Wompi webhook NO idempotente — duplica `historial_pagos` | HIGH | UNIQUE constraint en `wompi_transaction_id` + verificar antes de INSERT en `app/api/wompi/webhook/route.ts` L72 |
| 2.9 | Policies duplicadas en `perfiles` (9 policies) | LOW | DROP policies legacy |

### SQL de Remediación — Fase 2

```sql
-- 2.1: FK facturas.user_id (ejecutar DESPUÉS de verificar 0 huérfanos)
-- Verificar primero:
SELECT f.id, f.num_factura, f.user_id FROM facturas f
LEFT JOIN auth.users u ON u.id = f.user_id WHERE u.id IS NULL;
-- Si 0 filas:
ALTER TABLE facturas ADD CONSTRAINT fk_facturas_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 2.2: perfiles.user_id NOT NULL
SELECT COUNT(*) FROM perfiles WHERE user_id IS NULL; -- debe ser 0
ALTER TABLE perfiles ALTER COLUMN user_id SET NOT NULL;

-- 2.3: Backfill organizacion_id NULLs
UPDATE facturas f SET organizacion_id = (
  SELECT organizacion_id FROM perfiles p WHERE p.user_id = f.user_id
) WHERE f.organizacion_id IS NULL;
-- Verificar 0 NULLs restantes, luego:
ALTER TABLE facturas ALTER COLUMN organizacion_id SET NOT NULL;
-- Repetir para: auditorias_rips, acuerdos_voluntades, pacientes

-- 2.4: Unificar audit_log (en código: migrar logAudit → registrarAuditLog)
UPDATE audit_log SET accion = action WHERE (accion = '' OR accion IS NULL) AND action != '';
-- Después de migrar código:
ALTER TABLE audit_log DROP COLUMN IF EXISTS action;

-- 2.5: Trigger genérico updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Aplicar a cada tabla:
CREATE TRIGGER set_updated_at BEFORE UPDATE ON facturas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON acuerdos_voluntades
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON credenciales_muv
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mapeos_sabana_eps
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON suscripciones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON respuestas_glosas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizaciones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 2.7: Índices faltantes
CREATE INDEX IF NOT EXISTS idx_auditorias_rips_user ON auditorias_rips(user_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_org ON perfiles(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_facturas_org_estado ON facturas(organizacion_id, estado);
CREATE INDEX IF NOT EXISTS idx_facturas_user_estado ON facturas(user_id, estado);

-- 2.8: Wompi idempotencia
CREATE UNIQUE INDEX IF NOT EXISTS idx_historial_wompi_tx
  ON historial_pagos(wompi_transaction_id) WHERE wompi_transaction_id IS NOT NULL;
```

**Archivos de código a modificar (2.4):** `lib/logger.ts` (logAudit), `lib/audit-log.ts` (registrarAuditLog) — unificar en una sola función usando columna `accion`.

**Archivos de código a modificar (2.6):** Buscar tipo TypeScript `TipoOrganizacion` en `lib/types/` — agregar `"ips"`.

**Archivos de código a modificar (2.8):** `app/api/wompi/webhook/route.ts` L72 — agregar verificación de existencia antes del insert, o usar upsert con `onConflict: "wompi_transaction_id"`.

---

## FASE 3 — Resiliencia y Calidad de Código (*paralelo con Fase 2*)

| # | Hallazgo | Severidad | Archivos clave | Qué hacer |
|---|----------|-----------|----------------|-----------|
| 3.1 | **Sin timeouts en llamadas HTTP** excepto MUV (Gemini, Matias ×7, Wompi, Telegram, Resend, embeddings) | CRITICAL | `lib/gemini.ts`, `lib/providers/matias-client.ts` (7 fetch calls: L66, L95, L111, L151, L177, L199, L221), `lib/wompi.ts` L108, `lib/telegram.ts`, `lib/embedding-service.ts` | `signal: AbortSignal.timeout(N)` en cada fetch. Seguir patrón de `lib/providers/muv-client.ts` L30 |
| 3.2 | **Pipeline IA duplicado** (~152 líneas idénticas web vs Telegram + instancia propia GoogleGenerativeAI en L28) | CRITICAL | `app/actions/clasificacion.ts`, `app/actions/telegram-clasificacion.ts` L28-180 | Extraer a `lib/clasificacion-pipeline.ts` con funciones `extraerTerminosRAG()`, `clasificarConGemini()`, `validarYEnriquecerResultado()`. Reusar `getGenAI()` de `lib/gemini.ts` |
| 3.3 | `createServiceClient()` duplicado en 5 archivos | MEDIUM | `api/telegram/webhook/route.ts`, `actions/telegram-clasificacion.ts`, `api/wompi/webhook/route.ts`, `api/cron/eliminar-cuentas/route.ts`, `actions/admin.ts` | Centralizar en `lib/supabase-server.ts` |
| 3.4 | Dashboard/benchmarks queries traen TODOS los registros para `reduce()` en JS | HIGH | `app/actions/dashboard.ts` L24/L42/L52, `app/actions/benchmarks.ts` L87/L115/L208-280 | Crear RPCs PostgreSQL con SUM/COUNT, reemplazar queries |
| 3.5 | N+1 en cron eliminación: loop secuencial de `deleteUser` | CRITICAL | `app/api/cron/eliminar-cuentas/route.ts` L56 | `Promise.allSettled()` para batch |
| 3.6 | Retorno inconsistente `{ success }` vs `{ exito }` | MEDIUM | `clasificacion.ts`, `acuerdos.ts`, `telegram-clasificacion.ts` | Unificar a `{ success: boolean, error?: string }` |
| 3.7 | `.catch(() => {})` traga errores (3 sitios) | MEDIUM | `app/pagos/page.tsx` L51, `components/Sidebar.tsx` L42/L51 | `.catch(e => devError("label", e))` |
| 3.8 | Audit log incompleto: 4 funciones sin logging | MEDIUM | `marcarComoDescargada()`, `radicarFactura()`, `registrarPago()`, `editarFacturaBorrador()` | Agregar `registrarAuditLog()` |
| 3.9 | `anularFactura()` retorna `{ success: true }` cuando 0 rows cambiaron | MEDIUM | `app/actions/facturas.ts` L208-225 | Verificar count del update, retornar error si 0 rows |
| 3.10 | Resolución vencida no validada al facturar | MEDIUM | `app/actions/facturas.ts` — `obtenerSiguienteNumeroFactura()` | Agregar check `fecha_vigencia_hasta >= CURRENT_DATE` |

### Detalle — 3.1 Timeouts

Timeouts recomendados por servicio:

| Servicio | Timeout | Justificación |
|----------|---------|---------------|
| Gemini AI | 30s | Clasificación puede ser lenta con prompts largos |
| Matias API | 30s | Facturación DIAN puede tardar |
| Wompi | 15s | Cobros son rápidos |
| Telegram API | 10s | Mensajes son rápidos |
| Resend | 10s | Envío email es rápido |
| Embedding service | 15s | Batch de embeddings |

Patrón (copiar de `muv-client.ts`):
```ts
const res = await fetch(url, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(30_000), // ← agregar esto
});
```

### Detalle — 3.2 Extraer pipeline clasificación

Crear `lib/clasificacion-pipeline.ts`:
```ts
export async function ejecutarPipelineClasificacion(texto: string, opciones: OpcionesPipeline) {
  // 1. Anonimizar
  const textoAnonimizado = anonimizarTextoMedico(texto);
  // 2. RAG extraction
  const textoAugmentado = await extraerTerminosRAG(textoAnonimizado);
  // 3. Clasificación Gemini (usando getGenAI() centralizado)
  const resultado = await clasificarConGemini(textoAugmentado);
  // 4. Validación y enriquecimiento
  return await validarYEnriquecerResultado(resultado, opciones);
}
```

Luego `clasificacion.ts` y `telegram-clasificacion.ts` simplemente llaman `ejecutarPipelineClasificacion()`.

---

## FASE 4 — Observabilidad y Deploy (*paralelo*)

| # | Hallazgo | Severidad | Qué hacer |
|---|----------|-----------|-----------|
| 4.1 | Sentry DSN hardcodeado en 3 archivos | LOW | Reemplazar con `process.env.NEXT_PUBLIC_SENTRY_DSN` en `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` |
| 4.2 | 16 env vars faltantes en `.env.example` | CRITICAL (deploy) | Completar `apps/web/.env.example` con: `RESEND_API_KEY`, `MUV_ENCRYPTION_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_KEY`, `WOMPI_ENVIRONMENT`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_LANDING_URL`, `CRON_SECRET`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_SENTRY_DSN` |
| 4.3 | Sin health check en app principal | MEDIUM | Crear `app/api/health/route.ts` que verifique Supabase + Redis |
| 4.4 | Sin correlation ID para trazabilidad | MEDIUM | Generar `x-request-id` en `middleware.ts` + propagarlo en `lib/logger.ts` + agregar como tag en Sentry |
| 4.5 | Mensaje de rate limit no se muestra en login | LOW | Agregar `demasiados_intentos: "Has excedido el número de intentos. Intenta de nuevo en 15 minutos."` a `MENSAJES_PERMITIDOS` en `app/login/page.tsx` |
| 4.6 | Sin flujo de recuperación de contraseña | MEDIUM | Crear `/forgot-password` page + server action con `supabase.auth.resetPasswordForEmail()` + link en login page |
| 4.7 | URL preview en fallback Telegram | LOW | En `app/api/telegram/webhook/route.ts` L21, usar `process.env.NEXT_PUBLIC_LANDING_URL` en vez de URL hardcodeada de preview |

---

## FASE 5 — Compliance y UX

| # | Hallazgo | Severidad | Qué hacer |
|---|----------|-----------|-----------|
| 5.1 | Sin export de datos del usuario (Habeas Data Ley 1581/2012) | HIGH | Crear `exportarDatosUsuario()` en `app/actions/cuenta.ts` que genere JSON/CSV con: perfil, facturas, pacientes, clasificaciones, pagos. Agregar botón en `/configuracion/perfil` |
| 5.2 | Sin `error.tsx` per route | MEDIUM | Crear `error.tsx` en: `app/dashboard/`, `app/facturas/`, `app/glosas/`, `app/pagos/`, `app/configuracion/` — similar a `app/global-error.tsx` pero preservando layout |
| 5.3 | Sin `loading.tsx` ni `not-found.tsx` | MEDIUM | Crear `app/not-found.tsx` custom + `loading.tsx` en rutas principales con skeleton |
| 5.4 | Sin protección `beforeunload` | LOW | Hook en `components/MedibillApp.tsx` con `window.addEventListener('beforeunload', ...)` cuando hay datos sin guardar |
| 5.5 | UTC vs Colombia timezone en `fecha_expedicion` | MEDIUM | En `app/actions/facturas.ts`, usar `new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })` |
| 5.6 | Error messages de Supabase expuestos al cliente | LOW | En server actions que retornan `error.message` de Supabase, wrappear con mensajes genéricos: `"Error al guardar. Intenta de nuevo."` |

---

## FASE 6 — Optimización y Deuda Técnica (*oportunístico*)

| # | Hallazgo | Severidad | Qué hacer |
|---|----------|-----------|-----------|
| 6.1 | Sin lazy loading de componentes pesados | LOW | `next/dynamic` para modales (ModalBusquedaCodigo, ModalRegistrarGlosa) y gráficos (recharts) |
| 6.2 | CSP `unsafe-inline` en script-src | LOW | Investigar nonces con Next.js App Router |
| 6.3 | Sin retry para Gemini (429) y Matias (500) | MEDIUM | Exponential backoff (max 3 intentos: 1s/2s/4s) en `lib/gemini.ts` y `lib/providers/matias-client.ts` |
| 6.4 | Respuestas de Matias API cast sin validación | MEDIUM | Zod schemas para `MatiasInvoiceResponse` y `MatiasStatusResponse` en `lib/providers/matias-client.ts` L134/L160 |
| 6.5 | Resend SDK inicializado sin verificar API key | LOW | Mover a función lazy que verifica key en `lib/email.ts` L3 |
| 6.6 | Telegram `enviarMensaje()` no verifica `res.ok` | LOW | Agregar `if (!res.ok) devError(...)` en `lib/telegram.ts` L30-87 |
| 6.7 | `actions/index.ts` no re-exporta 12 módulos | LOW | Completar barrel exports o eliminar si no se usa |
| 6.8 | Sin sistema de migraciones versionado | MEDIUM | Adoptar `supabase/migrations/` con baseline del estado actual |
| 6.9 | Telegram audio ~12-16s (riesgo timeout Vercel free) | MEDIUM | Documentar requisito Pro tier o responder 200 inmediato + procesar async |
| 6.10 | Email radicación fallido no se audita | LOW | Agregar `registrarAuditLog` en catch de `app/actions/radicacion.ts` ~L260 |
| 6.11 | Hard delete en acuerdos y tarifas (riesgo compliance) | LOW | Cambiar DELETE por UPDATE `activo = false` + audit log en `app/actions/acuerdos.ts` y `app/actions/tarifas.ts` |

---

## Archivos a Modificar (~30 archivos principales)

### Server Actions (15 archivos)
- `apps/web/app/actions/facturas.ts` — RBAC + Zod + audit + anular fix + timezone + resolución
- `apps/web/app/actions/clasificacion.ts` — RBAC + extract pipeline
- `apps/web/app/actions/dian.ts` — RBAC
- `apps/web/app/actions/acuerdos.ts` — RBAC + Zod
- `apps/web/app/actions/perfil.ts` — RBAC + Zod (mass assignment fix)
- `apps/web/app/actions/pagos.ts` — RBAC + Zod (monto > 0)
- `apps/web/app/actions/respuesta-glosas.ts` — RBAC + magic bytes
- `apps/web/app/actions/conciliacion.ts` — RBAC + magic bytes
- `apps/web/app/actions/glosas.ts` — RBAC
- `apps/web/app/actions/muv.ts` — RBAC
- `apps/web/app/actions/radicacion.ts` — RBAC + audit
- `apps/web/app/actions/dashboard.ts` — getContextoOrg + SQL RPC
- `apps/web/app/actions/benchmarks.ts` — getContextoOrg + SQL RPC
- `apps/web/app/actions/telegram-clasificacion.ts` — extract pipeline
- `apps/web/app/actions/cuenta.ts` — data export

### API Routes (3 archivos)
- `apps/web/app/api/telegram/webhook/route.ts` — secret token + URL fix
- `apps/web/app/api/wompi/webhook/route.ts` — idempotency
- `apps/web/app/api/cron/eliminar-cuentas/route.ts` — N+1 fix

### Libs (8 archivos)
- `apps/web/lib/gemini.ts` — timeouts
- `apps/web/lib/providers/matias-client.ts` — timeouts + Zod responses
- `apps/web/lib/wompi.ts` — timeouts
- `apps/web/lib/telegram.ts` — timeouts + verify res.ok
- `apps/web/lib/email.ts` — lazy init
- `apps/web/lib/supabase-server.ts` — createServiceClient()
- `apps/web/lib/logger.ts` — unify audit + correlation ID
- `apps/web/lib/embedding-service.ts` — timeouts

### Config (4 archivos)
- `apps/web/middleware.ts` — correlation ID
- `apps/web/sentry.client.config.ts` — DSN env var
- `apps/web/sentry.server.config.ts` — DSN env var
- `apps/web/sentry.edge.config.ts` — DSN env var

### New Files
- `apps/web/lib/schemas/*.ts` — Zod schemas (6-8 archivos)
- `apps/web/lib/clasificacion-pipeline.ts` — Pipeline compartido
- `apps/web/app/api/health/route.ts` — Health check endpoint
- `apps/web/app/not-found.tsx` — Custom 404
- `apps/web/app/{ruta}/error.tsx` — Error boundaries (5 archivos)
- `apps/web/app/{ruta}/loading.tsx` — Loading states
- `apps/web/app/forgot-password/page.tsx` — Password recovery

### SQL Migrations (Supabase Editor)
- ~12 scripts SQL (documentados en Fase 0 y Fase 2)

---

## Plan de Verificación

| Fase | Método | Criterio de éxito |
|------|--------|-------------------|
| 0 | Queries SQL de verificación + Postman con anon key | INSERT con anon → 403; query cross-tenant → solo datos propios |
| 1 | `__tests__/rbac.test.ts` (cada rol × cada acción) + `__tests__/validation.test.ts` | Todos los tests pasan; rol auditor no puede aprobar facturas |
| 2 | Queries de integridad del reporte DB §3.2 | 0 huérfanos, 0 NULLs en columnas NOT NULL |
| 3 | `pnpm turbo build` + `pnpm turbo test` | 0 errores TypeScript, todos los tests pasan |
| 4 | GET /api/health, grep DSN hardcodeado | 200 OK, 0 DSN hardcodeados |
| 5 | Navegación manual con roles distintos | Cada rol ve lo correcto, export funciona |
| 6 | Build + tests | Sin regresiones |
| **Global** | Flujo end-to-end: clasificar → factura → DIAN → radicar → pago con roles doctor, facturador, auditor | Completado sin errores, RBAC enforced en cada paso |

---

## Decisions

| Decisión | Justificación |
|----------|---------------|
| **Zod** sobre Yup/Joi | Integración nativa TypeScript, tree-shaking, ecosistema Next.js |
| **`getContextoOrg()`** como patrón único de auth | Proporciona `ctx.rol` + `ctx.orgId` para RBAC uniforme |
| **SQL RPCs** para agregaciones | Más eficiente que fetch-all + JS reduce; PostgreSQL nativo ideal para SUM/COUNT |
| **Timeouts:** 30s Gemini/Matias, 15s Wompi, 10s Telegram | Basados en latencias típicas documentadas |

### Excluido del plan (requiere decisión separada)

| Item | Razón |
|------|-------|
| Encriptación at-rest a nivel de columna | Decisión arquitectural mayor — evaluación de impacto en performance y queries |
| CI/CD setup (Vercel deploys automáticos) | Requiere acceso a Vercel dashboard |
| Disaster Recovery runbook | Documento operativo, no código |
| Consentimiento directo de pacientes | Requiere flujo UX completo + decisión legal |
