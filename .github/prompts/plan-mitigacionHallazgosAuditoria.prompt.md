
# Plan: Mitigación de Hallazgos de Auditoría Integral Medibill

## TL;DR
Corregir 9 hallazgos de seguridad y DB detectados en la auditoría integral, priorizados por impacto.
Se agrupan en 4 fases: **Fase A (Crítica — DB permisos)**, **Fase B (Alta — código defensivo)**, **Fase C (Media — DB schema)**, **Fase D (Baja — mejoras CSP)**. Cada fase es independientemente desplegable.

---

## Fase A — CRÍTICA: Permisos de Base de Datos (bloquea deploy)

> Estas son migraciones SQL ejecutables en Supabase Dashboard → SQL Editor.

### Paso 1: Revocar permisos excesivos del rol `anon` (SEC-002)

**Problema:** `anon` tiene DELETE, INSERT, UPDATE, TRUNCATE en 30+ tablas sensibles incluyendo `credenciales_muv`, `suscripciones`, `rate_limits`, `cie10_maestro`, etc.

**Acción:** Crear migración SQL `001_revoke_anon_permissions.sql` que:
- Revoque ALL del rol `anon` en todas las tablas excepto las que legítimamente necesita
- Tablas que `anon` SÍ necesita: `planes` (SELECT, para landing page de precios)
- Tablas catálogo que requieren `authenticated` no `anon`: ya tienen policies correctas con `roles={authenticated}` (cie10, cups, causales, cups_alias, cups_categorias, reglas_coherencia)
- GRANT SELECT on `planes` TO anon (ya tiene policy `planes_select` con `USING=true`)

**Archivos:**
- `supabase/migrations/001_revoke_anon_permissions.sql` — nuevo

**SQL de referencia:**
```sql
-- Revocar todo de anon excepto planes
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
-- Re-grant solo lo necesario
GRANT SELECT ON public.planes TO anon;
-- Re-grant catálogos para authenticated (ya tenían policies)
GRANT SELECT ON public.catalogo_causales_glosa TO authenticated;
GRANT SELECT ON public.cie10_maestro TO authenticated;
-- ... (continuar para todas las tablas con el rol mínimo)
```

**Riesgo:** ALTO si se revoca algo que el flujo de onboarding o login necesite con `anon`. Probar en staging primero.

### Paso 2: Activar FORCE ROW LEVEL SECURITY (SEC-004)

**Problema:** Ninguna tabla tiene `FORCE ROW LEVEL SECURITY`. Si se conecta accidentalmente con rol postgres, bypasea todo RLS.

**Acción:** Crear migración `002_force_rls.sql`:
```sql
ALTER TABLE facturas FORCE ROW LEVEL SECURITY;
ALTER TABLE pacientes FORCE ROW LEVEL SECURITY;
ALTER TABLE perfiles FORCE ROW LEVEL SECURITY;
-- ... para TODAS las 36 tablas
```

**Archivos:**
- `supabase/migrations/002_force_rls.sql` — nuevo

**Riesgo:** Bajo. No afecta a `service_role` ni a `authenticated`/`anon`, solo a table owners.

### Paso 3: Rotar Service Role Key (SEC-001)

**Problema:** La SUPABASE_SERVICE_ROLE_KEY real está expuesta en `.env.local` del workspace (JWT completo visible en grep results de la auditoría).

**Acción manual (no código):**
1. Ir a Supabase Dashboard → Settings → API → Regenerar service_role key
2. Actualizar `.env.local` con la nueva key
3. Actualizar la key en Vercel Dashboard → Environment Variables
4. Verificar que los cron jobs y webhooks siguen funcionando

**Nota:** Esto NO requiere cambios de código, solo rotación de secreto.

---

## Fase B — ALTA: Hardening de Código (paralelo con Fase A)

### Paso 4: Asegurar `tarifas.ts` con permisos + validación Zod (SEC-006)

**Problema:** `guardarTarifaUsuario` no verifica permisos de rol ni valida input con Zod. `eliminarTarifaUsuario` tampoco. `buscarCupsParaTarifa` no verifica auth.

**Acción:** Modificar `app/actions/tarifas.ts`:
- Agregar import de `getContextoOrg`, `verificarPermisoOError`
- Crear schema Zod `GuardarTarifaSchema` en `lib/schemas/tarifas.schema.ts`:
  ```
  z.object({
    codigo: z.string().min(1).max(10),
    descripcion: z.string().min(1).max(500),
    valor: z.number().positive().max(999_999_999),
  })
  ```
- En `guardarTarifaUsuario`: reemplazar `auth.getUser()` por `getContextoOrg()`, agregar `verificarPermisoOError(ctx.rol, "crear_factura")` (o nuevo permiso `gestionar_tarifas`), validar con Zod
- En `eliminarTarifaUsuario`: misma refactorización
- En `obtenerTarifasUsuario`: usar `getContextoOrg()` para consistencia
- En `buscarCupsParaTarifa`: agregar check de auth (ya existe `verificarAuth` pattern en `busqueda-codigos.ts`)

**Archivos:**
- `app/actions/tarifas.ts` — modificar
- `lib/schemas/tarifas.schema.ts` — crear
- `lib/permisos.ts` — agregar `gestionar_tarifas` al mapa (opcional, o usar `crear_factura`)

**Patrón de referencia:** Seguir exactamente el pattern de `app/actions/perfil.ts` líneas 33-47 (GuardarPerfilSchema + verificarPermisoOError).

### Paso 5: Proteger Telegram webhook contra bypass de secret (SEC-003 parcial)

**Problema:** El Telegram webhook acepta requests sin secret si `TELEGRAM_WEBHOOK_SECRET` no está configurado (`if (webhookSecret) { ... }`). En producción debe ser obligatorio.

**Acción:** Modificar `app/api/telegram/webhook/route.ts` línea 33:
- Cambiar `if (webhookSecret)` a: retornar 403 si `webhookSecret` no existe en producción
- Patrón: `if (!webhookSecret) return 500 en prod`

**Archivos:**
- `app/api/telegram/webhook/route.ts` — modificar (línea 33)

### Paso 6: Documentar política de auth para API routes (SEC-003)

**Problema:** El middleware bypasea `/api/*` completamente. Cada API route se auto-protege. No hay verificación automática.

**Acción:** Crear un test que verifique que todas las API routes tienen auth check (más robusto que documentación):
- Crear `__tests__/api-auth-coverage.test.ts` que importa/lee cada route handler y verifica que contiene `getUser`, `CRON_SECRET`, o `webhookSecret` pattern
- Alternativamente: agregar un comment-block en `middleware.ts` documentando que CADA API route DEBE verificar auth internamente

**Archivos:**
- `__tests__/api-auth-coverage.test.ts` — nuevo (test de cobertura)
- `middleware.ts` — agregar comentario (línea 10)

---

## Fase C — MEDIA: Schema de Base de Datos (requiere testing)

### Paso 7: Cambiar UNIQUE de `facturas.num_factura` a per-org (DB-002)

**Problema:** `facturas_num_factura_key` es UNIQUE global. Dos orgs no pueden usar el mismo prefijo/número. Además, `BORR-{timestamp_base36}` puede colisionar si se crean 2 facturas en el mismo ms.

**Acción:** Migración SQL:
```sql
-- Eliminar constraint global
ALTER TABLE facturas DROP CONSTRAINT facturas_num_factura_key;
-- Crear constraint per-org
ALTER TABLE facturas ADD CONSTRAINT facturas_org_num_factura_key 
  UNIQUE (organizacion_id, num_factura);
```
Y en `app/actions/facturas.ts` línea 69, agregar unicidad al BORR:
```ts
const numero = `BORR-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,4)}`;
```

**Archivos:**
- `supabase/migrations/003_facturas_unique_per_org.sql` — nuevo
- `app/actions/facturas.ts` — modificar (línea 69)

**Dependencia:** Ninguna. Puede ejecutarse en paralelo con Fases A y B.

### Paso 8: Sincronizar CHECK constraint de `pagos.metodo_pago` (DB-003)

**Problema:** El CHECK de DB permite: transferencia, cheque, efectivo, consignacion, compensacion, otro. El schema Zod incluye "tarjeta" que fallaría en INSERT.

**Opción A (recomendada):** Agregar "tarjeta" al CHECK de DB:
```sql
ALTER TABLE pagos DROP CONSTRAINT pagos_metodo_pago_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_pago_check 
  CHECK (metodo_pago = ANY(ARRAY['transferencia','cheque','efectivo','consignacion','compensacion','tarjeta','otro']));
```

**Opción B:** Quitar "tarjeta" del Zod enum. Pero "tarjeta" es un método legítimo.

**Archivos:**
- `supabase/migrations/004_pagos_metodo_tarjeta.sql` — nuevo

---

## Fase D — BAJA: Mejoras de Seguridad a Futuro

### Paso 9: Migrar CSP de `unsafe-inline` a nonces (SEC-005)

**Problema:** CSP usa `'unsafe-inline'` para `script-src`. Ya existe un TODO en `next.config.js` línea 39.

**Acción:** 
1. Generar un nonce por request en `middleware.ts`
2. Inyectar el nonce en los headers CSP
3. Pasar el nonce a `<Script>` tags vía `next/headers`
4. Eliminar `'unsafe-inline'` de `script-src`

**Archivos:**
- `middleware.ts` — modificar (generar nonce, setear header)
- `next.config.js` — modificar CSP (reemplazar unsafe-inline por `'nonce-{value}'`)
- `app/layout.tsx` — pasar nonce a scripts si hay

**Nota:** Next.js 16 tiene soporte nativo para esto. Requiere testing extensivo porque cualquier script inline sin nonce se rompe.

---

## Verificación

### Automatizada
1. **Paso 1-2 (SQL):** Ejecutar query `SELECT grantee, privilege_type, table_name FROM information_schema.role_table_grants WHERE grantee = 'anon'` — debe retornar solo `planes SELECT`
2. **Paso 2:** Ejecutar query `SELECT relname, relforcerowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace` — todo debe ser `true`
3. **Paso 4:** Test existente `pnpm test` debe seguir pasando + agregar test unitario para Zod schema
4. **Paso 7:** Crear dos facturas en orgs distintas con mismo prefijo — debe funcionar
5. **Paso 8:** Registrar pago con `metodo_pago = 'tarjeta'` — no debe fallar

### Manual
1. **Paso 3:** Después de rotar key: verificar login, webhook Wompi test, cron manual
2. **Paso 5:** Enviar POST a `/api/telegram/webhook` sin header secret — debe recibir 403
3. **Paso 9:** Navegar toda la app en dev y verificar que no hay errores CSP en consola

## Decisiones
- El permiso para tarifas usa `crear_factura` (ya existente) en vez de crear un nuevo permiso `gestionar_tarifas` — más simple, un doctor que puede facturar puede gestionar sus tarifas
- Se prefiere Opción A para DB-003 (agregar "tarjeta" al CHECK) porque es un método de pago legítimo
- No se mueve la auth de API routes al middleware — cambiar ese patrón ahora crearía riesgo de regresión. En su lugar se documenta y se crea test de cobertura
