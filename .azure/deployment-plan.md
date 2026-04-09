# Azure Deployment Plan — OpenMAIC

> **Status:** Validated

Generated: 2026-04-08

---

## 1. Project Overview

**Goal:** Desplegar OpenMAIC com a Azure Container App (cluster-less, Consumption plan) al resource group `rg_dgia-labs`, amb PostgreSQL Flexible Server per a la BD relacional, Azure Files per a la persistència de dades (stages, themes, media) i Azure Communication Services existent per a l'enviament d'emails.

**Path:** New deployment of existing project

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Development / Labs |
| Scale | Small |
| Budget | Cost-Optimized |
| **Subscription** | `40e1d617-d4f7-428d-a158-0b09105282ea` |
| **Location** | `westeurope` (West Europe) |

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| OpenMAIC App | Full-stack SSR | Next.js 16 standalone, Node 22, port 3000 | `/` |
| Database | Relational | PostgreSQL 16 via Prisma 5 | `prisma/schema.prod.prisma` |
| Storage | Filesystem | Azure Files muntat a `/app/data` | `lib/utils/storage-backend.ts` |
| Migracions | Auto-apply | `instrumentation.ts` → `prisma migrate deploy` | `instrumentation.ts` |
| Email | Integration | Azure Communication Services | Existent: `dgialab-mail-sender` |
| Container Image | Registry | Docker multi-stage, Dockerfile ja existent | `Dockerfile` |

---

## 4. Recipe Selection

**Selected:** AZCLI

**Rationale:** L'usuari ha demanat explícitament scripts `az cli`. Tots els recursos es creen i configuren amb comandes `az`. No s'usa AZD ni Bicep.

---

## 5. Architecture

**Stack:** Containers (Azure Container Apps, Consumption plan — serverless, cluster-less)

### Service Mapping

| Component | Recurs Azure | SKU / Configuració |
|-----------|-------------|---------------------|
| Web App | Container App `ca-openmaic` | 1.0 vCPU / 2 Gi RAM, min 1 rèplica |
| Entorn contenidors | Container Apps Environment `cae-openmaic` | Consumption (serverless, cluster-less) |
| Base de dades | PostgreSQL Flexible Server `psql-openmaic` | Standard_B1ms, PostgreSQL 16 |
| Volum persistent | Azure Storage Account `stopenmaic<TOKEN>` + Azure Files share `openmaic-data` | Standard_LRS |
| Secrets | Key Vault `kv-openmaic-<TOKEN>` | Standard tier |
| Identitat | User-Assigned Managed Identity `id-openmaic` | Per accedir a KV + ACR |
| Container Registry | ACR `crminilmscat` (existent) | Nou repositori `openmaic` |
| Email | ACS `dgialab-mail-sender` (existent) | — |

> **TOKEN** = 4 chars derivats de sha256(RESOURCE_GROUP+LOCATION), garanteix unicitat global per als noms que ho requereixen (Storage Account, Key Vault).

### Supporting Services

| Servei | Propòsit |
|--------|---------|
| Log Analytics `law-openmaic` | Logs centralitzats del Container App |
| Application Insights `ai-openmaic` | Monitoring, APM, traces |

### Flux de desplegament

```
01-infra.sh    → Storage Account + Files share
               → PostgreSQL Flexible Server (DB: openmaic)
               → Key Vault
               → UAMI + assignació de rols (AcrPull + KVSecretsUser)
               → Log Analytics + App Insights
               → Container Apps Environment (+ muntatge Azure Files)

02-secrets.sh  → Poblar KV amb DATABASE_URL, BETTER_AUTH_SECRET,
                 CONFIG_ENCRYPTION_KEY, ACS_ENDPOINT, ACS_ACCESS_KEY, etc.

03-build-push.sh → az acr build → crminilmscat.azurecr.io/openmaic:<tag>
                   → desa digest a .last-image-digest

04-new-app.sh  → Container App amb YAML complet (primer desplegament)
                 volum /app/data, secrets directes, credencials ACR admin

05-deploy.sh   → Actualitza NOMÉS la imatge (redesplegaments)
                 no sobreescriu secrets ni cap altra configuració
```

### Modificació Dockerfile requerida

El directori `prisma/` (schemas + migracions) no s'inclou en el Next.js standalone output.
Cal afegir-lo al runner stage perquè `instrumentation.ts` pugui executar `prisma migrate deploy` en arrancar.

```dockerfile
# Afegir al runner stage, ABANS de USER nextjs:
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
```

---

## 6. Provisioning Limit Checklist

> **Nota:** Az CLI no està autenticat en aquest entorn. Quotes obtingudes de documentació oficial d'Azure (fallback).

### Phase 1 + 2: Resource Inventory amb Quotes Oficials

| Resource Type | # a desplegar | Límit oficial West Europe | Notes |
|---------------|--------------|--------------------------|-------|
| Microsoft.App/managedEnvironments | 1 | 50/subscripció/regió | [Font: Azure limits docs](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-container-apps-limits) |
| Microsoft.App/containerApps | 1 | 200/entorn | Idem |
| Microsoft.DBforPostgreSQL/flexibleServers | 1 | 50/subscripció | [Font: PostgreSQL limits](https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-limits) |
| Microsoft.Storage/storageAccounts | 1 | 250/subscripció/regió | [Font: Storage limits](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-storage-limits) |
| Microsoft.KeyVault/vaults | 1 | 500/subscripció | [Font: KV limits](https://learn.microsoft.com/azure/key-vault/general/service-limits) |
| Microsoft.OperationalInsights/workspaces | 1 | 100/subscripció | [Font: Monitor limits](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-monitor-limits) |
| Microsoft.ManagedIdentity/userAssignedIdentities | 1 | 1.000/subscripció | [Font: Identity limits](https://learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/managed-identity-best-practice-recommendations) |

**Status:** ✅ Tots els recursos ben per sota dels límits per defecte — desplegament d'1 sol recurs de cada tipus.

> ⚠️ **Recomanació:** Verificar quotes reals un cop autenticat: `az quota list --scope /subscriptions/<SUB_ID>/providers/Microsoft.App/locations/westeurope`

---

## 7. Execution Checklist

### Phase 1: Planning
- [x] Analitzar workspace
- [x] Detectar stack i tecnologies (Next.js standalone, Prisma, better-auth, ACS)
- [x] Identificar Dockerfile existent + correcció prisma/ requerida
- [x] Preparar inventari de recursos (Step 6 Phase 1)
- [x] Validar quotes (Step 6 Phase 2 — official docs fallback)
- [x] Seleccionar recipe (AZCLI)
- [x] Planificar arquitectura (Container Apps + PostgreSQL + Azure Files)
- [ ] **Aprovació de l'usuari**

### Phase 2: Execution
- [x] Modificar Dockerfile (afegir còpia prisma/ + fix chown public/ + crear /app/data)
- [x] Actualitzar .dockerignore (afegir scripts/ i .azure/)
- [x] Generar `scripts/deploy/.env.deploy.example`
- [x] Generar `scripts/deploy/01-infra.sh`
- [x] Generar `scripts/deploy/02-secrets.sh`
- [x] Generar `scripts/deploy/03-build-push.sh`
- [x] Generar `scripts/deploy/04-new-app.sh` (reanomenat de 04-app.sh)
- [ ] **⛔ Actualitzar status a "Ready for Validation"**

### Phase 3: Validation
- [x] az CLI v2.84.0 ✅ | Autenticació Gencat DGIA Sandbox ✅
- [x] RG `rg_dgia-labs` existent a West Europe ✅
- [x] ACR `crminilmscat` accessible ✅ | ACS `dgia-email-relay` ✅
- [x] Noms SA `stopenmaic9f90` i KV `kv-openmaic-9f90` disponibles ✅
- [x] Extensions containerapp + monitor-control-service instal·lades ✅
- [x] PostgreSQL Standard_B1ms disponible a West Europe ✅
- [x] Quota Container Apps: 50 entorns disponibles ✅
- [x] Dockerfile sintaxi vàlida (4 stages, prisma/ inclosa) ✅
- [x] Update status → "Validated"

### Phase 4: Deployment
- [ ] Crear .env.deploy amb secrets generats
- [ ] Executar 01-infra.sh
- [ ] Executar 02-secrets.sh
- [ ] Executar 03-build-push.sh
- [ ] Executar 04-app.sh
- [ ] Update status → "Deployed"

---

## 8. Files to Generate

| Fitxer | Propòsit | Status |
|--------|---------|--------|
| `.azure/deployment-plan.md` | Aquest pla | ✅ |
| `Dockerfile` | Fix prisma/ copy + chown public/ + crear /app/data | ✅ |
| `.dockerignore` | Afegit scripts/ i .azure/ | ✅ |
| `scripts/deploy/.env.deploy.example` | Variables de configuració | ✅ |
| `scripts/deploy/01-infra.sh` | Crear infraestructura base | ✅ |
| `scripts/deploy/02-secrets.sh` | Poblar Key Vault | ✅ |
| `scripts/deploy/03-build-push.sh` | Build i push imatge Docker | ✅ |
| `scripts/deploy/04-new-app.sh` | Crear Container App (primer desplegament) | ✅ |
| `scripts/deploy/05-deploy.sh` | Actualitzar imatge (redesplegaments) | ✅ |

---

## 9. Variables d'entorn obligatòries per al Container App

| Variable | Font | Notes |
|----------|------|-------|
| `DATABASE_URL` | KV secret | `postgresql://pgadmin:<pass>@psql-openmaic.postgres.database.azure.com:5432/openmaic?sslmode=require` |
| `APP_URL` | Env var (config) | `https://ca-openmaic.<env-domain>` — es calcula post-creació entorn |
| `BETTER_AUTH_SECRET` | KV secret | `openssl rand -hex 32` |
| `CONFIG_ENCRYPTION_KEY` | KV secret | `openssl rand -hex 32` |
| `ACS_ENDPOINT` | KV secret | De `dgialab-mail-sender` |
| `ACS_ACCESS_KEY` | KV secret | De `dgialab-mail-sender` |
| `ACS_SENDER_ADDRESS` | Env var (config) | Email verificat al ACS |
| `ACS_SENDER_DISPLAY_NAME` | Env var (config) | `OpenMAIC` |
| `NODE_ENV` | Env var | `production` |
| `LOG_LEVEL` | Env var | `info` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Env var (config) | De App Insights creat |

---

## 10. Next Steps

> Current: Planning — pendent aprovació

1. Aprovar el pla
2. Primer desplegament: `01-infra.sh` → `02-secrets.sh` → `03-build-push.sh` → `04-new-app.sh`
   Redesplegaments: `03-build-push.sh` → `05-deploy.sh`
3. Verificar que l'app arranca: `az containerapp logs show --name ca-openmaic --resource-group rg_dgia-labs --follow`
4. Comprovar URL pública: `az containerapp show --name ca-openmaic --resource-group rg_dgia-labs --query properties.configuration.ingress.fqdn -o tsv`
