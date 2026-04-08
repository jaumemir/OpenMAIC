#!/bin/bash
# ============================================================
# 03-build-push.sh — Build i push de la imatge Docker a ACR
# ============================================================
# Usa `az acr build` (build al núvol, no requereix Docker local).
# Registre: crminilmscat.azurecr.io
# Repositori: openmaic  (NOU — no és minilmscat)
#
# Prerequisit: 01-infra.sh executat, login az actiu.
# Ús: bash scripts/deploy/03-build-push.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.deploy"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No s'ha trobat $ENV_FILE"
  exit 1
fi

source "$ENV_FILE"

: "${SUBSCRIPTION_ID:?Falta SUBSCRIPTION_ID}"
: "${ACR_NAME:?Falta ACR_NAME}"
: "${ACR_REPO:?Falta ACR_REPO}"

# Tag per defecte: sha curt del commit actual
if [[ -z "${IMAGE_TAG:-}" ]] || [[ "$IMAGE_TAG" == "latest" ]]; then
  GIT_SHA=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "latest")
  IMAGE_TAG="$GIT_SHA"
fi

FULL_IMAGE="${ACR_NAME}.azurecr.io/${ACR_REPO}:${IMAGE_TAG}"
FULL_IMAGE_LATEST="${ACR_NAME}.azurecr.io/${ACR_REPO}:latest"

az account set --subscription "$SUBSCRIPTION_ID"

echo "============================================================"
echo " OpenMAIC — Build i push de la imatge Docker"
echo " ACR       : $ACR_NAME.azurecr.io"
echo " Repositori: $ACR_REPO  (NOU — no és minilmscat)"
echo " Tag       : $IMAGE_TAG"
echo " Imatge    : $FULL_IMAGE"
echo "============================================================"

# Build al núvol via az acr build (no requereix Docker local ni login a ACR)
az acr build \
  --registry "$ACR_NAME" \
  --subscription "$SUBSCRIPTION_ID" \
  --image "${ACR_REPO}:${IMAGE_TAG}" \
  --image "${ACR_REPO}:latest" \
  --file "$PROJECT_ROOT/Dockerfile" \
  "$PROJECT_ROOT"

# Obtenir el digest de la imatge publicada (per evitar problemes amb :latest al desplegament)
IMAGE_DIGEST=$(az acr repository show \
  --name "$ACR_NAME" \
  --image "${ACR_REPO}:${IMAGE_TAG}" \
  --query digest -o tsv)

DIGEST_REF="${ACR_NAME}.azurecr.io/${ACR_REPO}@${IMAGE_DIGEST}"

# Guardar el digest per a 04-app.sh
echo "IMAGE_DIGEST=${IMAGE_DIGEST}" > "$SCRIPT_DIR/.last-image-digest"
echo "IMAGE_DIGEST_REF=${DIGEST_REF}" >> "$SCRIPT_DIR/.last-image-digest"
echo "IMAGE_TAG_USED=${IMAGE_TAG}" >> "$SCRIPT_DIR/.last-image-digest"

echo ""
echo "============================================================"
echo " Imatge publicada:"
echo "   $FULL_IMAGE"
echo "   $FULL_IMAGE_LATEST"
echo " Digest:"
echo "   $DIGEST_REF"
echo "============================================================"
echo " Proper pas: bash scripts/deploy/04-app.sh"
echo "============================================================"
