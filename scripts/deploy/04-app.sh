#!/bin/bash
# ============================================================
# 04-app.sh — Crear o actualitzar la Container App d'OpenMAIC
# ============================================================
# Usa secrets directes (no KV) per compatibilitat amb entorns
# on les condicions ABAC impedeixen roleAssignments.
# Usa credencials admin ACR per al pull de la imatge.
#
# Prerequisits: 01, 03 executats.
# Ús: bash scripts/deploy/04-app.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.deploy"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No s'ha trobat $ENV_FILE"
  exit 1
fi

source "$ENV_FILE"

: "${SUBSCRIPTION_ID:?Falta SUBSCRIPTION_ID}"
: "${RESOURCE_GROUP:?Falta RESOURCE_GROUP}"
: "${LOCATION:?Falta LOCATION}"
: "${PSQL_ADMIN_PASSWORD:?Falta PSQL_ADMIN_PASSWORD}"
: "${BETTER_AUTH_SECRET:?Falta BETTER_AUTH_SECRET}"
: "${CONFIG_ENCRYPTION_KEY:?Falta CONFIG_ENCRYPTION_KEY}"

TOKEN=$(echo -n "${RESOURCE_GROUP}${LOCATION}" | sha256sum | cut -c1-4)

az account set --subscription "$SUBSCRIPTION_ID"

# Resolució de valors necessaris
CAE_ID=$(az containerapp env show \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)

ENV_DOMAIN=$(az containerapp env show \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.defaultDomain -o tsv)

APP_URL="https://${CONTAINER_APP_NAME}.${ENV_DOMAIN}"

# Imatge: preferir digest (evita que Container Apps ignori el canvi amb :latest)
DIGEST_FILE="$SCRIPT_DIR/.last-image-digest"
if [[ -f "$DIGEST_FILE" ]]; then
  source "$DIGEST_FILE"
  FULL_IMAGE="${IMAGE_DIGEST_REF}"
else
  # Fallback: construir tag i obtenir digest des d'ACR
  if [[ -z "${IMAGE_TAG:-}" ]] || [[ "$IMAGE_TAG" == "latest" ]]; then
    GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
    IMAGE_TAG="$GIT_SHA"
  fi
  IMAGE_DIGEST=$(az acr repository show \
    --name "$ACR_NAME" \
    --image "${ACR_REPO}:${IMAGE_TAG}" \
    --query digest -o tsv 2>/dev/null || echo "")
  if [[ -n "$IMAGE_DIGEST" ]]; then
    FULL_IMAGE="${ACR_NAME}.azurecr.io/${ACR_REPO}@${IMAGE_DIGEST}"
  else
    FULL_IMAGE="${ACR_NAME}.azurecr.io/${ACR_REPO}:${IMAGE_TAG}"
  fi
fi

# Credencials admin ACR (fallback quan RBAC no permet AcrPull via UAMI)
ACR_ADMIN_PASS=$(az acr credential show \
  --name "$ACR_NAME" \
  --query "passwords[0].value" -o tsv)

# App Insights connection string
AI_CONN_STRING=$(az monitor app-insights component show \
  --app "$APP_INSIGHTS" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString -o tsv 2>/dev/null || echo "")

# Connection string PostgreSQL
PSQL_HOST="${PSQL_SERVER}.postgres.database.azure.com"
DB_URL="postgresql://${PSQL_ADMIN_USER}:${PSQL_ADMIN_PASSWORD}@${PSQL_HOST}:5432/${PSQL_DB}?sslmode=require"

echo "============================================================"
echo " OpenMAIC — Desplegant Container App"
echo " Container App : $CONTAINER_APP_NAME"
echo " Entorn        : $CONTAINER_APP_ENV"
echo " APP_URL       : $APP_URL"
echo " Imatge        : $FULL_IMAGE"
echo " Auth ACR      : admin credentials (RBAC no disponible)"
echo "============================================================"

# Generar manifest YAML
YAML_FILE="$(mktemp /tmp/openmaic-containerapp-XXXX.yaml)"

cat > "$YAML_FILE" << YAML
name: ${CONTAINER_APP_NAME}
type: Microsoft.App/containerApps
location: ${LOCATION}
properties:
  managedEnvironmentId: "${CAE_ID}"
  configuration:
    ingress:
      external: true
      targetPort: 3000
      transport: auto
      allowInsecure: false
      traffic:
        - latestRevision: true
          weight: 100
    registries:
      - server: ${ACR_NAME}.azurecr.io
        username: ${ACR_NAME}
        passwordSecretRef: acr-admin-password
    secrets:
      - name: acr-admin-password
        value: "${ACR_ADMIN_PASS}"
      - name: database-url
        value: "${DB_URL}"
      - name: better-auth-secret
        value: "${BETTER_AUTH_SECRET}"
      - name: config-encryption-key
        value: "${CONFIG_ENCRYPTION_KEY}"
      - name: acs-endpoint
        value: "https://dgia-email-relay.germany.communication.azure.com/"
      - name: acs-access-key
        value: "REMOVED_ACS_KEY"
  template:
    volumes:
      - name: openmaic-data
        storageName: openmaic-data
        storageType: AzureFile
    containers:
      - name: openmaic
        image: "${FULL_IMAGE}"
        resources:
          cpu: 1.0
          memory: 2Gi
        volumeMounts:
          - volumeName: openmaic-data
            mountPath: /app/data
        env:
          - name: NODE_ENV
            value: production
          - name: APP_URL
            value: "${APP_URL}"
          - name: DATABASE_URL
            secretRef: database-url
          - name: BETTER_AUTH_SECRET
            secretRef: better-auth-secret
          - name: CONFIG_ENCRYPTION_KEY
            secretRef: config-encryption-key
          - name: ACS_ENDPOINT
            secretRef: acs-endpoint
          - name: ACS_ACCESS_KEY
            secretRef: acs-access-key
          - name: ACS_SENDER_ADDRESS
            value: "${ACS_SENDER_ADDRESS}"
          - name: ACS_SENDER_DISPLAY_NAME
            value: "${ACS_SENDER_DISPLAY_NAME}"
          - name: LOG_LEVEL
            value: "info"
          - name: LOG_FORMAT
            value: "json"
          - name: APPLICATIONINSIGHTS_CONNECTION_STRING
            value: "${AI_CONN_STRING}"
          - name: ADMIN_DEFAULT_EMAIL
            value: "${ADMIN_DEFAULT_EMAIL:-admin@openmaic.local}"
          - name: ADMIN_DEFAULT_PASSWORD
            value: "${ADMIN_DEFAULT_PASSWORD:-Admin2026!}"
          - name: ADMIN_DEFAULT_FIRSTNAME
            value: "${ADMIN_DEFAULT_FIRSTNAME:-Admin}"
          - name: ADMIN_DEFAULT_LASTNAME
            value: "${ADMIN_DEFAULT_LASTNAME:-System}"
        probes:
          - type: Liveness
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 60
            periodSeconds: 30
            failureThreshold: 3
          - type: Readiness
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
    scale:
      minReplicas: 1
      maxReplicas: 3
      rules:
        - name: http-scaling
          http:
            metadata:
              concurrentRequests: "20"
YAML

# Crear o actualitzar la Container App
if az containerapp show \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --only-show-errors \
    --output none 2>/dev/null; then
  echo "    Actualitzant Container App existent..."
  az containerapp update \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --yaml "$YAML_FILE" \
    --only-show-errors \
    --output none
else
  echo "    Creant nova Container App..."
  az containerapp create \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --yaml "$YAML_FILE" \
    --only-show-errors \
    --output none
fi

rm -f "$YAML_FILE"

# FQDN final
FQDN=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "============================================================"
echo " DESPLEGAMENT COMPLETAT"
echo "============================================================"
echo " URL pública : https://${FQDN}"
echo " Logs        : az containerapp logs show \\"
echo "               --name $CONTAINER_APP_NAME \\"
echo "               --resource-group $RESOURCE_GROUP --follow"
echo "============================================================"
