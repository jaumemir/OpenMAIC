#!/bin/sh
# start.sh — Startup script per al contenidor de producció.
# S'executa com a CMD del runner. Fa les migracions Prisma ABANS d'iniciar l'app.

set -e

# Detectar schema: SQLite (dev local) o PostgreSQL (prod)
if echo "${DATABASE_URL:-}" | grep -q "^file:"; then
  SCHEMA="/app/prisma/schema.dev.prisma"
else
  SCHEMA="/app/prisma/schema.prod.prisma"
fi

# Prisma CLI: instal·lat globalment via `npm install -g prisma@5.22.0` al Dockerfile runner
echo "[OpenMAIC] BD: aplicant migracions ($SCHEMA)..."
prisma migrate deploy --schema="$SCHEMA" 2>&1 && \
  echo "[OpenMAIC] BD: migracions aplicades." || \
  echo "[OpenMAIC] BD: error en migracions (continuant)"

exec node server.js
