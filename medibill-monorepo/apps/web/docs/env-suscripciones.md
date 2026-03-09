# Variables de entorno para el sistema de suscripciones y pagos

## Wompi (Pasarela de pagos Colombia)

```bash
# Llave pública para el widget de checkout (frontend)
WOMPI_PUBLIC_KEY=pub_test_xxxxxxxxxxxxxxxx

# Llave privada para cobros con token y verificación (backend only)
WOMPI_PRIVATE_KEY=prv_test_xxxxxxxxxxxxxxxx

# Secreto para verificar firmas de webhooks
WOMPI_EVENTS_SECRET=test_events_xxxxxxxxxxxxxxxx

# Llave para generar firma de integridad del checkout
WOMPI_INTEGRITY_KEY=test_integrity_xxxxxxxxxxxxxxxx

# Entorno: "sandbox" para pruebas, "production" para producción
WOMPI_ENVIRONMENT=sandbox
```

## Supabase (requerida para webhooks - service role)

```bash
# Ya deberías tener estas:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...

# Requerida para el webhook de Wompi (operaciones admin sin contexto de usuario)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
```

## URLs de la aplicación

```bash
# URL base de la app (para generar links de checkout y de invitación)
NEXT_PUBLIC_APP_URL=https://app.medibill.co
```

## Cómo obtener las llaves de Wompi

1. Crear cuenta en https://comercios.wompi.co
2. Ir a "Desarrolladores" → "Llaves de API"
3. Copiar las llaves de sandbox para desarrollo
4. Para producción, completar el proceso de verificación de Wompi

## Configurar Webhook en Wompi

1. En el panel de Wompi → "Webhooks"
2. URL del webhook: `https://app.medibill.co/api/wompi/webhook`
3. Eventos a suscribir: `transaction.updated`
4. Copiar el "Events secret" y ponerlo en `WOMPI_EVENTS_SECRET`
