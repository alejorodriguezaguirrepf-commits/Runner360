#!/usr/bin/env bash
# Verifica migraciones, seeds y políticas RLS contra un PostgreSQL local (sin Supabase CLI).
# Requiere: psql y un servidor PostgreSQL >= 15 accesible (por defecto: usuario postgres local).
# Uso: PGHOST=... PGUSER=... bash scripts/verify-db.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${VERIFY_DB_NAME:-runner360_verify}"
PSQL_BASE=(psql -v ON_ERROR_STOP=1 -q -X)
if [[ -z "${PGUSER:-}" && "$(id -u)" == "0" ]]; then RUN=(sudo -u postgres); else RUN=(); fi

"${RUN[@]}" "${PSQL_BASE[@]}" -d postgres -c "drop database if exists ${DB};" -c "create database ${DB};"
run() { "${RUN[@]}" "${PSQL_BASE[@]}" -d "${DB}" -f "$1"; }

echo "→ Emulación Supabase (solo para pruebas locales)"; run "${ROOT}/supabase/tests/00_supabase_shim.sql"
for f in "${ROOT}"/supabase/migrations/*.sql; do echo "→ Migración $(basename "$f")"; run "$f"; done
for f in "${ROOT}"/supabase/seed/*.sql; do echo "→ Seed $(basename "$f")"; run "$f"; done
echo "→ Pruebas de seguridad"
"${RUN[@]}" "${PSQL_BASE[@]}" -d "${DB}" -f "${ROOT}/supabase/tests/10_rls_test.sql" 2>&1 | sed 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /'
echo "→ Reaplicando seeds (idempotencia)"
for f in "${ROOT}"/supabase/seed/*.sql; do run "$f"; done
"${RUN[@]}" "${PSQL_BASE[@]}" -d "${DB}" -tAc "select 'versiones publicadas: ' || count(*) from public.training_plan_versions where status = 'published'"
