# MUV Service — Cloud Run Deployment
# Mecanismo Único de Validación (MinSalud)
#
# Este Dockerfile empaqueta el servicio MUV para Cloud Run.
# Recibe XML (FEV DIAN) + JSON RIPS y retorna CUV o errores.
#
# Build:  docker build -t muv-service ./infra/muv-docker
# Run:    docker run -p 8080:8080 muv-service
# Deploy: gcloud run deploy muv-service --source ./infra/muv-docker --region us-central1

FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias del sistema para procesamiento XML
RUN apk add --no-cache libxml2 libxslt

# Copiar package y lockfile
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copiar código fuente
COPY . .

# Puerto que Cloud Run asigna
ENV PORT=8080
EXPOSE 8080

# Health check para Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
