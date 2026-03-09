# MUV Service — Cloud Run Deployment

## Prerequisitos
1. Google Cloud CLI instalado (`gcloud`)
2. Proyecto GCP creado
3. Artifact Registry habilitado

## Deploy

```bash
# 1. Autenticarse
gcloud auth login

# 2. Configurar proyecto
gcloud config set project YOUR_PROJECT_ID

# 3. Habilitar servicios necesarios
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# 4. Desplegar desde origen (Cloud Build + Cloud Run)
cd infra/muv-docker
gcloud run deploy muv-service \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 60 \
  --set-env-vars "MUV_MINSALUD_URL="
```

## Obtener URL

```bash
gcloud run services describe muv-service --region us-central1 --format "value(status.url)"
# Output: https://muv-service-xxxxx-uc.a.run.app
```

## Configurar en Vercel

Agregar variable de entorno en Vercel:
```
MUV_DOCKER_URL=https://muv-service-xxxxx-uc.a.run.app
```

## Costos estimados
- **Free tier**: 2M requests/month, 360K vCPU-seconds
- **Con uso normal** (~1000 validaciones/mes): $0.00

## Modos de operación

### Modo local (desarrollo)
Sin `MUV_MINSALUD_URL` — valida estructura XML/RIPS y genera CUV local.

### Modo producción
Con `MUV_MINSALUD_URL` configurada — valida contra el MUV real de MinSalud usando credenciales del prestador.
