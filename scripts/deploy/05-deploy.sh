#!/bin/bash
# ============================================================
# 05-deploy.sh — Actualitzar la imatge de la Container App
# ============================================================
# Actualitza NOMÉS la imatge del Container App existent.
# No sobreescriu secrets, variables d'entorn ni cap altra
# configuració de l'app.
#
# Prerequisit: 03-build-push.sh executat (genera .last-image-digest)
# Ús: bash scripts/deploy/05-deploy.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.deploy"
DIGEST_FILE="$SCRIPT_DIR/.last-image-digest"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No s'ha trobat $ENV_FILE"
  exit 1
fi

if [[ ! -f "$DIGEST_FILE" ]]; then
  echo "ERROR: No s'ha trobat $DIGEST_FILE — executa primer 03-build-push.sh"
  exit 1
fi

source "$ENV_FILE"
source "$DIGEST_FILE"

: "${SUBSCRIPTION_ID:?Falta SUBSCRIPTION_ID}"
: "${RESOURCE_GROUP:?Falta RESOURCE_GROUP}"
: "${CONTAINER_APP_NAME:?Falta CONTAINER_APP_NAME}"
: "${IMAGE_DIGEST_REF:?Falta IMAGE_DIGEST_REF (executa 03-build-push.sh primer)}"

az account set --subscription "$SUBSCRIPTION_ID"

echo "============================================================"
echo " OpenMAIC — Actualitzant imatge del Container App"
echo " Container App : $CONTAINER_APP_NAME"
echo " Resource Group: $RESOURCE_GROUP"
echo " Imatge        : $IMAGE_DIGEST_REF"
echo "============================================================"

az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$IMAGE_DIGEST_REF" \
  --only-show-errors

FQDN=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "============================================================"
echo " DESPLEGAMENT COMPLETAT"
echo " URL pública : https://${FQDN}"
echo " Logs        : az containerapp logs show \\"
echo "               --name $CONTAINER_APP_NAME \\"
echo "               --resource-group $RESOURCE_GROUP --follow"
echo "============================================================"
