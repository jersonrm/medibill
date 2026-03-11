# PROMPT: Auditoría Integral de Seguridad, Funcionalidad e Integridad — Nivel Producción

> **Instrucción para el agente:** Ejecuta esta auditoría de forma exhaustiva, metódica y sin atajos. Actúa como un equipo combinado de QA Lead, Security Engineer y DBA senior auditando una aplicación que va a producción. No asumas que nada funciona — verifica todo.

---

## FASE 0 — RECONOCIMIENTO Y MAPEO COMPLETO

Antes de testear cualquier cosa, necesito que entiendas la aplicación al 100%.

### 0.1 Inventario de Arquitectura
- Lee TODOS los archivos de configuración: `package.json`, `tsconfig.json`, `.env*`, `next.config.*`, `tailwind.config.*`, `middleware.*`, archivos Docker, CI/CD configs.
- Identifica y documenta: framework, versión de Node/runtime, ORM o cliente de DB, proveedor de autenticación, servicios externos (APIs, AI, storage, email, etc.).
- Genera un mapa de dependencias: lista TODAS las dependencias con su versión y clasifícalas en (a) core del framework, (b) autenticación/seguridad, (c) UI, (d) utilidades, (e) servicios externos.

### 0.2 Mapeo de Rutas y Endpoints
- Escanea TODAS las rutas: pages, app router, API routes, server actions, middleware.
- Para cada ruta documenta: método HTTP, si es pública o protegida, qué rol(es) puede acceder, qué datos recibe y qué responde.
- Identifica rutas huérfanas (definidas pero no referenciadas desde ningún lugar).

### 0.3 Modelo de Datos Completo
- Lee TODOS los schemas de base de datos: migraciones, archivos SQL, schemas de ORM, tipos TypeScript que representen tablas.
- Documenta cada tabla con: columnas, tipos, constraints, relaciones FK, índices, RLS policies si existen.
- Identifica: tablas sin uso aparente, columnas que nunca se leen/escriben en el código, relaciones FK faltantes.

### 0.4 Mapa de Roles y Permisos
- Identifica todos los roles de usuario que el sistema maneja (admin, médico, paciente, operador, etc.).
- Para cada rol documenta: qué rutas puede acceder, qué operaciones CRUD puede hacer en cada tabla, qué datos puede ver.
- Si hay RLS (Row Level Security), documenta cada policy y qué filtra exactamente.

**ENTREGABLE FASE 0:** Un documento `AUDIT_MAP.md` con toda esta información antes de continuar.

---

## FASE 1 — AUDITORÍA DE SEGURIDAD

### 1.1 Autenticación
- [ ] ¿Cómo se manejan las sesiones? (JWT, cookies, tokens). Verifica expiración, refresh, revocación.
- [ ] ¿Existe protección contra brute force en login? (rate limiting, captcha, lockout).
- [ ] ¿Los tokens se almacenan de forma segura? (HttpOnly, Secure, SameSite).
- [ ] ¿Hay rutas de API que sean accesibles sin autenticación y no deberían serlo?
- [ ] ¿El flujo de recuperación de contraseña es seguro? (tokens de un solo uso, expiración, no enumera usuarios).
- [ ] ¿Se valida el estado de la sesión en CADA request protegido, tanto en cliente como en servidor?
- [ ] Busca: tokens hardcodeados, secrets en código fuente, `.env` commiteados, API keys expuestas.

### 1.2 Autorización
- [ ] Para CADA endpoint de API y server action: ¿se verifica el rol del usuario antes de ejecutar la operación?
- [ ] Intenta escenarios de escalación de privilegios: ¿un usuario con rol bajo puede acceder a endpoints de admin modificando la request?
- [ ] ¿Las operaciones CRUD verifican que el usuario tiene permiso sobre ESE recurso específico? (no solo el rol, sino la propiedad del dato — IDOR).
- [ ] ¿Existe middleware de autorización centralizado o cada ruta implementa su propia lógica? Evalúa consistencia.
- [ ] Si hay RLS: ¿las policies cubren ALL operations (SELECT, INSERT, UPDATE, DELETE) para cada tabla sensible?
- [ ] ¿Hay bypass posible de RLS por service_role key mal usada en el cliente?

### 1.3 Validación de Entrada
- [ ] Para CADA formulario y endpoint que recibe datos: ¿hay validación tanto en cliente como en servidor?
- [ ] ¿Se usa una librería de validación (Zod, Yup, joi)? ¿Los schemas son completos y correctos?
- [ ] Busca vulnerabilidades de inyección: SQL injection (queries raw sin parametrizar), NoSQL injection, command injection.
- [ ] ¿Los campos de texto libre sanitizan HTML? Busca vectores de XSS almacenado y reflejado.
- [ ] ¿Se validan tipos, rangos numéricos, longitudes máximas, formatos de email/teléfono/fecha?
- [ ] ¿Los uploads de archivos validan tipo MIME real (no solo extensión), tamaño máximo, y almacenamiento seguro?
- [ ] ¿Se previene mass assignment? (¿se aceptan solo los campos esperados o se pasa el body completo al DB?)

### 1.4 Protección contra Ataques Comunes
- [ ] CSRF: ¿hay tokens CSRF en formularios que mutan estado? ¿Las API routes verifican origin/referer?
- [ ] XSS: ¿se escapan todas las salidas dinámicas? ¿Hay uso de `dangerouslySetInnerHTML` o equivalentes?
- [ ] Headers de seguridad: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy.
- [ ] CORS: ¿está configurado correctamente? ¿No acepta `*` en producción?
- [ ] Rate limiting: ¿existe en endpoints sensibles (login, registro, API pública, AI calls)?
- [ ] ¿Hay protección contra enumeration attacks? (respuestas genéricas en login fallido, registro con email existente, etc.)

### 1.5 Datos Sensibles
- [ ] ¿Se loguean datos sensibles? (passwords, tokens, datos médicos, PII en console.log, logs de servidor).
- [ ] ¿Los errores de producción exponen stack traces, queries SQL, o estructura interna?
- [ ] ¿Hay datos sensibles en el código fuente (strings hardcodeados, comments con credenciales)?
- [ ] ¿Las variables de entorno están correctamente separadas por ambiente?
- [ ] ¿Los datos sensibles en DB están encriptados at rest cuando es requerido por regulación?
- [ ] ¿Hay compliance con regulaciones aplicables (habeas data Colombia, HIPAA si aplica)?

**ENTREGABLE FASE 1:** Archivo `SECURITY_AUDIT.md` con cada check marcado PASS/FAIL/WARNING, evidencia del hallazgo, y severidad (CRITICAL/HIGH/MEDIUM/LOW).

---

## FASE 2 — PRUEBAS FUNCIONALES POR ESCENARIO DE USUARIO

Para cada rol identificado en la Fase 0, simula el flujo completo de un usuario real.

### 2.1 Matriz de Escenarios
Crea una tabla con esta estructura para CADA flujo funcional:

| # | Rol | Escenario | Precondiciones | Pasos | Resultado Esperado | Resultado Real | PASS/FAIL |
|---|-----|-----------|----------------|-------|--------------------|----------------|-----------|

### 2.2 Flujos Críticos a Testear (mínimo)
Para cada módulo/feature de la aplicación, verifica:

**Flujos de escritura (Create/Update):**
- [ ] ¿El formulario valida todos los campos requeridos antes de enviar?
- [ ] ¿Se muestra feedback al usuario (loading, success, error)?
- [ ] ¿Los datos llegan correctamente a la base de datos con el formato y tipos esperados?
- [ ] ¿Se manejan correctamente los caracteres especiales, Unicode, emojis, campos vacíos?
- [ ] ¿Qué pasa si se envía el formulario dos veces rápidamente? (prevención de duplicados)
- [ ] ¿Qué pasa si el servidor responde con error? ¿El UI se recupera correctamente?

**Flujos de lectura (Read/List):**
- [ ] ¿Las listas cargan los datos correctos para el usuario autenticado?
- [ ] ¿La paginación funciona? ¿Los filtros y búsquedas devuelven resultados correctos?
- [ ] ¿Un usuario solo ve SUS datos? (verificar aislamiento entre usuarios/organizaciones)
- [ ] ¿Qué muestra el UI cuando no hay datos? (empty states)
- [ ] ¿Los datos se muestran con el formato correcto? (moneda, fechas, decimales, zona horaria)

**Flujos de eliminación (Delete):**
- [ ] ¿Hay confirmación antes de eliminar?
- [ ] ¿La eliminación es soft-delete o hard-delete? ¿Es consistente con las reglas de negocio?
- [ ] ¿Se actualizan las relaciones dependientes? (cascade, set null, o se bloquea si hay dependencias)
- [ ] ¿El UI se actualiza inmediatamente después de eliminar?

**Flujos de transición de estado (Workflows):**
- [ ] ¿Cada transición de estado es válida? (ej: borrador → enviado → aprobado, no borrador → aprobado directo)
- [ ] ¿Las transiciones inválidas están bloqueadas tanto en UI como en backend?
- [ ] ¿Los cambios de estado se registran (audit trail)?
- [ ] ¿Se envían notificaciones/acciones derivadas cuando corresponde?

### 2.3 Pruebas de Integración entre Módulos
- [ ] Verifica que los datos fluyen correctamente entre módulos (ej: un registro creado en módulo A aparece correctamente en módulo B).
- [ ] ¿Las acciones en un módulo actualizan las métricas/dashboards en tiempo real?
- [ ] ¿Los cálculos agregados (totales, promedios, conteos) son consistentes en todos los lugares donde aparecen?

### 2.4 Pruebas de Edge Cases
- [ ] Campos con valores límite: 0, negativos, máximos, strings vacíos, strings muy largos (>10000 chars).
- [ ] Concurrencia: ¿qué pasa si dos usuarios editan el mismo registro al tiempo?
- [ ] Sesión expirada a mitad de un flujo: ¿se pierde el trabajo? ¿Se redirige correctamente?
- [ ] Navegación con back/forward del navegador en medio de un flujo multi-paso.
- [ ] ¿Qué pasa si un servicio externo (API de IA, servicio de email, etc.) no responde o da error?

**ENTREGABLE FASE 2:** Archivo `FUNCTIONAL_TESTS.md` con la matriz completa de escenarios y resultados.

---

## FASE 3 — INTEGRIDAD DE BASE DE DATOS

### 3.1 Schema y Constraints
- [ ] ¿Todas las columnas NOT NULL tienen valor default o son requeridas en la lógica de inserción?
- [ ] ¿Todas las relaciones tienen FK constraints definidas en la DB (no solo en el ORM)?
- [ ] ¿Los tipos de datos son los correctos? (ej: no usar TEXT para lo que debería ser INTEGER, no usar VARCHAR sin límite para campos acotados).
- [ ] ¿Los ENUM o check constraints cubren todos los valores válidos del negocio?
- [ ] ¿Existen índices en las columnas usadas en WHERE, JOIN, ORDER BY frecuentes?
- [ ] ¿Hay índices compuestos donde se necesitan?

### 3.2 Consistencia de Datos
Ejecuta estas consultas diagnósticas y reporta los resultados:
- [ ] Registros huérfanos: filas que referencian registros padre inexistentes.
- [ ] Duplicados donde no debería haberlos: registros con datos que deberían ser únicos pero no tienen UNIQUE constraint.
- [ ] Valores fuera de rango: números negativos donde solo se esperan positivos, fechas en el futuro donde no aplica, etc.
- [ ] NULL en columnas que semánticamente deberían ser requeridas pero no tienen NOT NULL.
- [ ] Inconsistencias de estado: registros en estados imposibles según las reglas de negocio (ej: factura "pagada" con monto $0 cuando no debería).
- [ ] Timestamps sospechosos: `created_at > updated_at`, registros sin timestamps, formatos inconsistentes.

### 3.3 RLS y Políticas de Acceso (si aplica Supabase/PostgreSQL)
- [ ] ¿RLS está habilitado en TODAS las tablas que contienen datos de usuarios?
- [ ] Para cada tabla con RLS: prueba que un usuario NO puede leer/escribir datos de otro usuario ejecutando queries directas.
- [ ] ¿Las políticas usan `auth.uid()` correctamente?
- [ ] ¿Hay tablas sensibles sin RLS habilitado?
- [ ] ¿Los service_role o admin bypasses están correctamente limitados al backend?

### 3.4 Migraciones
- [ ] ¿Las migraciones están versionadas y se pueden ejecutar en orden limpiamente?
- [ ] ¿Hay migraciones destructivas sin reversibilidad (DROP sin backup lógico)?
- [ ] ¿El estado actual de la DB coincide con lo que las migraciones describen?

**ENTREGABLE FASE 3:** Archivo `DATABASE_INTEGRITY.md` con queries ejecutadas, resultados, y hallazgos.

---

## FASE 4 — CALIDAD DE CÓDIGO Y ARQUITECTURA

### 4.1 Análisis Estático
- [ ] ¿Hay errores de TypeScript? Ejecuta `tsc --noEmit` y reporta.
- [ ] ¿Hay warnings del linter ignorados? Ejecuta ESLint y reporta.
- [ ] Busca: `any` types abusivos, `@ts-ignore` sin justificación, `eslint-disable` sin razón.
- [ ] ¿Hay código muerto? (funciones, componentes, utilidades, rutas no referenciadas).
- [ ] ¿Hay duplicación significativa de lógica? (copy-paste code).

### 4.2 Manejo de Errores
- [ ] ¿Las llamadas a APIs externos tienen try/catch con manejo de errores específico?
- [ ] ¿Los errores de DB se manejan y no se propagan raw al usuario?
- [ ] ¿Hay un error boundary global en el frontend?
- [ ] ¿Los server actions retornan errores de forma estandarizada?
- [ ] ¿Hay logging de errores para debugging en producción (pero sin datos sensibles)?

### 4.3 Performance (Análisis Estático)
- [ ] ¿Hay N+1 queries? (loops que hacen queries individuales en vez de batch).
- [ ] ¿Se usa lazy loading donde aplica?
- [ ] ¿Hay componentes pesados que re-renderizan innecesariamente?
- [ ] ¿Las imágenes están optimizadas? (next/image, formatos modernos, tamaños apropiados).
- [ ] ¿Hay queries sin paginación que podrían traer miles de registros?
- [ ] ¿Las llamadas a servicios de IA tienen timeout y manejo de costos?

### 4.4 Patrones y Consistencia
- [ ] ¿La estructura de carpetas es consistente y predecible?
- [ ] ¿Los nombres de archivos, funciones, variables siguen convenciones consistentes?
- [ ] ¿Se usan patrones de diseño apropiados? (ej: no lógica de negocio en componentes de UI).
- [ ] ¿La separación de concerns es clara? (data fetching vs rendering vs business logic).
- [ ] ¿Las utilidades compartidas están centralizadas o hay implementaciones locales duplicadas?

**ENTREGABLE FASE 4:** Archivo `CODE_QUALITY.md` con hallazgos clasificados por severidad.

---

## FASE 5 — VALIDACIÓN DE INTEGRACIONES EXTERNAS

### 5.1 Para cada servicio externo que la app consume:
- [ ] ¿La integración tiene manejo de errores robusto? (timeout, retry, fallback).
- [ ] ¿Qué pasa si el servicio está caído? ¿La app sigue funcionando en lo que no depende de él?
- [ ] ¿Los API keys/secrets están en variables de entorno, no en código?
- [ ] ¿Se valida la respuesta del servicio externo antes de usarla? (no asumir estructura).
- [ ] ¿Hay rate limits del servicio externo que la app podría exceder?
- [ ] ¿Los costos de servicios de pago (ej: AI APIs) están controlados? (límites, monitoreo).

### 5.2 Webhooks y Callbacks (si aplica)
- [ ] ¿Se valida la autenticidad del webhook (firma, token)?
- [ ] ¿Son idempotentes? (recibir el mismo webhook dos veces no causa duplicados).
- [ ] ¿Responden rápido (< 5 segundos) y delegan trabajo pesado a background jobs?

**ENTREGABLE FASE 5:** Archivo `INTEGRATIONS_AUDIT.md`.

---

## FASE 6 — PREPARACIÓN PARA PRODUCCIÓN

### 6.1 Checklist de Deploy
- [ ] ¿Existe `.env.example` documentando todas las variables necesarias?
- [ ] ¿El build de producción compila sin errores ni warnings?
- [ ] ¿Hay un proceso de CI/CD configurado?
- [ ] ¿Las variables de entorno de producción son diferentes a desarrollo?
- [ ] ¿El `DEBUG` o modo de desarrollo está desactivado?
- [ ] ¿Hay health checks configurados?

### 6.2 Observabilidad
- [ ] ¿Existe logging estructurado para producción?
- [ ] ¿Hay monitoreo de errores configurado (Sentry, etc.)?
- [ ] ¿Existe algún dashboard de métricas de aplicación?
- [ ] ¿Se pueden trazar requests de un usuario a través de toda la stack?

### 6.3 Backup y Recovery
- [ ] ¿Hay backups automáticos de la base de datos?
- [ ] ¿Se ha probado restaurar un backup?
- [ ] ¿Hay un plan documentado de recuperación ante desastres?

**ENTREGABLE FASE 6:** Archivo `PRODUCTION_READINESS.md`.

---

## FORMATO DEL REPORTE FINAL

Al completar todas las fases, genera un archivo `AUDIT_SUMMARY.md` con:

1. **Resumen Ejecutivo** (máximo 10 líneas): estado general de la aplicación, principales riesgos.
2. **Estadísticas**: total de checks ejecutados, PASS/FAIL/WARNING por fase.
3. **Hallazgos Críticos**: issues que DEBEN resolverse antes de ir a producción (bloquean el deploy).
4. **Hallazgos Altos**: issues que representan riesgo significativo pero no bloquean.
5. **Hallazgos Medios/Bajos**: mejoras recomendadas.
6. **Plan de Remediación Sugerido**: priorizado por impacto y esfuerzo estimado.

Para cada hallazgo incluye:
- **ID**: ej. `SEC-001`, `FUNC-012`, `DB-003`
- **Severidad**: CRITICAL / HIGH / MEDIUM / LOW
- **Ubicación**: archivo(s) y línea(s) exactas
- **Descripción**: qué encontraste
- **Impacto**: qué podría pasar si no se corrige
- **Remediación**: cómo corregirlo con ejemplo de código si aplica

---

## REGLAS DE EJECUCIÓN

1. **No asumas — verifica.** Si no puedes ejecutar algo, documenta qué intentaste y por qué no fue posible.
2. **Sé específico.** Siempre incluye nombres de archivo, números de línea, queries exactas.
3. **Ejecuta código cuando puedas.** Corre TypeScript checker, linter, queries de diagnóstico de DB reales.
4. **Prioriza impacto.** No pierdas tiempo en code style si hay inyección SQL abierta.
5. **Documenta TODO.** Cada fase produce su entregable antes de pasar a la siguiente.
6. **Si encuentras un CRITICAL, no lo dejes para el final.** Menciónalo inmediatamente con contexto.
