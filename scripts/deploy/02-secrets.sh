#!/bin/bash
# ============================================================
# 02-secrets.sh — Poblar Key Vault amb secrets de l'app
# ============================================================
# Prerequisit: 01-infra.sh executat correctament.
#
# Ús: bash scripts/deploy/02-secrets.sh
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
KV_NAME="kv-openmaic-${TOKEN}"
PSQL_HOST="${PSQL_SERVER}.postgres.database.azure.com"

az account set --subscription "$SUBSCRIPTION_ID"

echo "============================================================"
echo " OpenMAIC — Poblant Key Vault: $KV_NAME"
echo "============================================================"

# Helper: crea o actualitza un secret al KV
kv_set() {
  local name="$1"
  local value="$2"
  az keyvault secret set \
    --vault-name "$KV_NAME" \
    --name "$name" \
    --value "$value" \
    --only-show-errors \
    --output none
  echo "    ✓ Secret: $name"
}

# ── DATABASE_URL ─────────────────────────────────────────────
DB_URL="postgresql://${PSQL_ADMIN_USER}:${PSQL_ADMIN_PASSWORD}@${PSQL_HOST}:5432/${PSQL_DB}?sslmode=require"
kv_set "database-url" "$DB_URL"

# ── Secrets de l'app ─────────────────────────────────────────
kv_set "better-auth-secret"     "$BETTER_AUTH_SECRET"
kv_set "config-encryption-key"  "$CONFIG_ENCRYPTION_KEY"

# ── Azure Communication Services ─────────────────────────────
# ACS_SERVICE_NAME ha de ser el nom del Communication Service (no l'Email Service)
# Ex: dgia-email-relay (NO dgialab-mail-sender que és l'Email Service)
echo "    Obtenint credencials ACS ($ACS_SERVICE_NAME)..."

# Usem az resource show (més fiable que az communication show per a properties)
ACS_HOST=$(az resource show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACS_SERVICE_NAME" \
  --resource-type "Microsoft.Communication/communicationServices" \
  --query "properties.hostName" -o tsv 2>/dev/null || echo "")

if [[ -z "$ACS_HOST" ]]; then
  # Cerca en tota la subscripció (si és en un altre RG)
  ACS_HOST=$(az resource list \
    --resource-type "Microsoft.Communication/communicationServices" \
    --query "[?name=='$ACS_SERVICE_NAME'].properties.hostName | [0]" -o tsv 2>/dev/null || echo "")
fi

if [[ -n "$ACS_HOST" ]]; then
  ACS_ENDPOINT_VAL="https://${ACS_HOST}/"
else
  ACS_ENDPOINT_VAL=""
fi

if [[ -z "$ACS_ENDPOINT_VAL" ]]; then
  echo "    ⚠️  No s'ha pogut obtenir l'endpoint ACS automàticament."
  echo "       Obtén-lo manualment: az communication service show --name $ACS_SERVICE_NAME"
  echo "       I executa: az keyvault secret set --vault-name $KV_NAME --name acs-endpoint --value <ENDPOINT>"
else
  kv_set "acs-endpoint" "$ACS_ENDPOINT_VAL"
fi

# Clau d'accés ACS
ACS_KEY_VAL=$(az communication service list-key \
  --name "$ACS_SERVICE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "primaryKey" -o tsv 2>/dev/null || echo "")

if [[ -z "$ACS_KEY_VAL" ]]; then
  echo "    ⚠️  No s'ha pogut obtenir la clau ACS automàticament."
  echo "       Executa: az keyvault secret set --vault-name $KV_NAME --name acs-access-key --value <KEY>"
else
  kv_set "acs-access-key" "$ACS_KEY_VAL"
fi

# ── Admin password (opcional) ────────────────────────────────
if [[ -n "${ADMIN_DEFAULT_PASSWORD:-}" ]]; then
  kv_set "admin-default-password" "$ADMIN_DEFAULT_PASSWORD"
fi

echo ""
echo "============================================================"
echo " Secrets poblats correctament a $KV_NAME"
echo "============================================================"
echo " Proper pas: bash scripts/deploy/03-build-push.sh"
echo "============================================================"
