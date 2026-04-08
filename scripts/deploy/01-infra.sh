#!/bin/bash
# ============================================================
# 01-infra.sh — Infraestructura base OpenMAIC a Azure
# ============================================================
# Crea: Storage Account + Azure Files, PostgreSQL Flexible Server,
#       Key Vault, User-Assigned Managed Identity, Log Analytics,
#       Application Insights, Container Apps Environment.
#
# Prerequisits:
#   az login
#   az account set --subscription $SUBSCRIPTION_ID
#   cp .env.deploy.example .env.deploy && edita .env.deploy
#
# Ús: bash scripts/deploy/01-infra.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.deploy"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No s'ha trobat $ENV_FILE"
  echo "Copia .env.deploy.example a .env.deploy i omple els valors."
  exit 1
fi

# shellcheck source=.env.deploy
source "$ENV_FILE"

# Validar variables obligatòries
: "${SUBSCRIPTION_ID:?Falta SUBSCRIPTION_ID}"
: "${RESOURCE_GROUP:?Falta RESOURCE_GROUP}"
: "${LOCATION:?Falta LOCATION}"
: "${PSQL_ADMIN_PASSWORD:?Falta PSQL_ADMIN_PASSWORD}"

# TOKEN de 4 chars per garantir unicitat global de noms (Storage, KV)
TOKEN=$(echo -n "${RESOURCE_GROUP}${LOCATION}" | sha256sum | cut -c1-4)
SA_NAME="stopenmaic${TOKEN}"
KV_NAME="kv-openmaic-${TOKEN}"
UAMI_NAME="id-openmaic"

echo "============================================================"
echo " OpenMAIC — Desplegament infraestructura"
echo " Subscripció : $SUBSCRIPTION_ID"
echo " Resource Group: $RESOURCE_GROUP"
echo " Localització : $LOCATION"
echo " TOKEN únic   : $TOKEN"
echo " Storage Acct : $SA_NAME"
echo " Key Vault    : $KV_NAME"
echo "============================================================"

# ── 0. Subscripció activa ────────────────────────────────────
az account set --subscription "$SUBSCRIPTION_ID"
echo "[0/8] Subscripció activa: $(az account show --query name -o tsv)"

# ── 1. Storage Account + Azure Files ────────────────────────
echo "[1/8] Storage Account i Azure Files share..."
az storage account create \
  --name "$SA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --only-show-errors \
  --output none

SA_KEY=$(az storage account keys list \
  --account-name "$SA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[0].value" -o tsv)

az storage share create \
  --name "openmaic-data" \
  --account-name "$SA_NAME" \
  --account-key "$SA_KEY" \
  --quota 50 \
  --only-show-errors \
  --output none
echo "    ✓ Storage: $SA_NAME | Share: openmaic-data (50 GiB)"

# ── 2. PostgreSQL Flexible Server ───────────────────────────
echo "[2/8] PostgreSQL Flexible Server..."
az postgres flexible-server create \
  --name "$PSQL_SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --admin-user "$PSQL_ADMIN_USER" \
  --admin-password "$PSQL_ADMIN_PASSWORD" \
  --sku-name "Standard_B1ms" \
  --tier "Burstable" \
  --version "16" \
  --storage-size 32 \
  --backup-retention 7 \
  --geo-redundant-backup Disabled \
  --public-access None \
  --only-show-errors \
  --output none || echo "    (ja existia o error no crític)"

# Crear la base de dades
az postgres flexible-server db create \
  --server "$PSQL_SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --database-name "$PSQL_DB" \
  --only-show-errors \
  --output none || echo "    (DB ja existia)"

# Permetre accés des d'Azure (Container Apps necessita accedir via IP d'Azure)
az postgres flexible-server firewall-rule create \
  --rule-name "AllowAzureServices" \
  --name "$PSQL_SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --only-show-errors \
  --output none || echo "    (regla ja existia)"

PSQL_HOST="${PSQL_SERVER}.postgres.database.azure.com"
echo "    ✓ PostgreSQL: $PSQL_HOST | DB: $PSQL_DB"

# ── 3. Key Vault ─────────────────────────────────────────────
echo "[3/8] Key Vault..."
az keyvault create \
  --name "$KV_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku standard \
  --enable-rbac-authorization true \
  --only-show-errors \
  --output none || echo "    (ja existia)"
echo "    ✓ Key Vault: $KV_NAME"

# ── 4. User-Assigned Managed Identity ───────────────────────
echo "[4/8] User-Assigned Managed Identity..."
az identity create \
  --name "$UAMI_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --only-show-errors \
  --output none || echo "    (ja existia)"

UAMI_ID=$(az identity show \
  --name "$UAMI_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)
UAMI_PRINCIPAL_ID=$(az identity show \
  --name "$UAMI_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query principalId -o tsv)
echo "    ✓ UAMI: $UAMI_NAME"

# Assignar rol AcrPull sobre el registre existent
ACR_ID=$(az acr show \
  --name "$ACR_NAME" \
  --query id -o tsv 2>/dev/null || echo "")
if [[ -n "$ACR_ID" ]]; then
  az role assignment create \
    --assignee-object-id "$UAMI_PRINCIPAL_ID" \
    --assignee-principal-type ServicePrincipal \
    --role "AcrPull" \
    --scope "$ACR_ID" \
    --only-show-errors \
    --output none || echo "    (rol AcrPull ja assignat)"
  echo "    ✓ Rol AcrPull → $ACR_NAME"
else
  echo "    ⚠️  No s'ha trobat el registre $ACR_NAME — assigna AcrPull manualment"
fi

# Assignar rol Key Vault Secrets User
KV_ID=$(az keyvault show \
  --name "$KV_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)
az role assignment create \
  --assignee-object-id "$UAMI_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope "$KV_ID" \
  --only-show-errors \
  --output none || echo "    (rol KV Secrets User ja assignat)"
echo "    ✓ Rol Key Vault Secrets User → $KV_NAME"

# ── 5. Log Analytics Workspace ──────────────────────────────
echo "[5/8] Log Analytics Workspace..."
az monitor log-analytics workspace create \
  --workspace-name "$LOG_ANALYTICS" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku PerGB2018 \
  --retention-time 30 \
  --only-show-errors \
  --output none || echo "    (ja existia)"

LAW_ID=$(az monitor log-analytics workspace show \
  --workspace-name "$LOG_ANALYTICS" \
  --resource-group "$RESOURCE_GROUP" \
  --query customerId -o tsv)
LAW_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --workspace-name "$LOG_ANALYTICS" \
  --resource-group "$RESOURCE_GROUP" \
  --query primarySharedKey -o tsv)
echo "    ✓ Log Analytics: $LOG_ANALYTICS"

# ── 6. Application Insights ─────────────────────────────────
echo "[6/8] Application Insights..."
LAW_RESOURCE_ID=$(az monitor log-analytics workspace show \
  --workspace-name "$LOG_ANALYTICS" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)

az monitor app-insights component create \
  --app "$APP_INSIGHTS" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --kind web \
  --workspace "$LAW_RESOURCE_ID" \
  --only-show-errors \
  --output none || echo "    (ja existia)"

AI_CONN_STRING=$(az monitor app-insights component show \
  --app "$APP_INSIGHTS" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString -o tsv)
echo "    ✓ App Insights: $APP_INSIGHTS"

# ── 7. Container Apps Environment ───────────────────────────
echo "[7/8] Container Apps Environment..."
az containerapp env create \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --logs-workspace-id "$LAW_ID" \
  --logs-workspace-key "$LAW_KEY" \
  --only-show-errors \
  --output none || echo "    (ja existia)"

# Muntar Azure Files com a storage de l'entorn
az containerapp env storage set \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --storage-name "openmaic-data" \
  --azure-file-account-name "$SA_NAME" \
  --azure-file-account-key "$SA_KEY" \
  --azure-file-share-name "openmaic-data" \
  --access-mode ReadWrite \
  --only-show-errors \
  --output none || echo "    (storage ja muntat)"

ENV_DOMAIN=$(az containerapp env show \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.defaultDomain -o tsv)
echo "    ✓ Container Apps Environment: $CONTAINER_APP_ENV"
echo "    ✓ Domini de l'entorn: $ENV_DOMAIN"

# ── 8. Obtenir endpoint ACS existent ────────────────────────
echo "[8/8] Obtenint dades ACS existent ($ACS_SERVICE_NAME)..."
ACS_ENDPOINT=$(az communication service show \
  --name "$ACS_SERVICE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.hostName -o tsv 2>/dev/null \
  | awk '{print "https://" $1}' || echo "")

if [[ -z "$ACS_ENDPOINT" ]]; then
  # Prova a cercar en tota la subscripció si no és al mateix RG
  ACS_ENDPOINT=$(az communication service list \
    --query "[?name=='$ACS_SERVICE_NAME'].properties.hostName" -o tsv 2>/dev/null \
    | awk '{print "https://" $1}' || echo "MANUAL_CHECK_REQUIRED")
fi
echo "    ✓ ACS Endpoint: ${ACS_ENDPOINT:-MANUAL_CHECK_REQUIRED}"

# ── Resum final ──────────────────────────────────────────────
echo ""
echo "============================================================"
echo " RESUM — Desa aquests valors per als passos següents"
echo "============================================================"
echo " TOKEN             : $TOKEN"
echo " Storage Account   : $SA_NAME"
echo " Key Vault         : $KV_NAME"
echo " UAMI ID           : $UAMI_ID"
echo " PSQL Host         : $PSQL_HOST"
echo " CAE Domain        : $ENV_DOMAIN"
echo " APP_URL (futura)  : https://ca-openmaic.${ENV_DOMAIN}"
echo " AI Conn String    : $AI_CONN_STRING"
echo " ACS Endpoint      : ${ACS_ENDPOINT:-MANUAL_CHECK_REQUIRED}"
echo "============================================================"
echo " Proper pas: bash scripts/deploy/02-secrets.sh"
echo "============================================================"
