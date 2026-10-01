#!/usr/bin/env bash
# Levanta un backend LOCAL compatible con Supabase (PostgreSQL + GoTrue + PostgREST + gateway) SIN Docker.
# Uso exclusivo para desarrollo y pruebas E2E en entornos sin Docker. La vía recomendada es `supabase start`.
# Requiere binarios en $SUPA_BIN (por defecto /opt/supa): auth (Supabase Auth v2.177.0) y postgrest (v12.2.3).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="${SUPA_BIN:-/opt/supa}"
DB="${LOCAL_DB:-runner360_local}"
SECRET="${LOCAL_JWT_SECRET:-runner360-local-jwt-secret-solo-para-pruebas-000}"
LOG="${LOCAL_LOG_DIR:-/tmp/runner360-local}"
mkdir -p "$LOG"
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1 -q -X)

if [[ "${1:-}" == "--reset" ]]; then
  for pf in "$LOG"/*.pid; do [[ -f "$pf" ]] && kill "$(cat "$pf")" 2>/dev/null || true; rm -f "$pf"; done
  "${PSQL[@]}" -d postgres -c "drop database if exists ${DB};"
fi
"${PSQL[@]}" -d postgres -tc "select 1 from pg_database where datname='${DB}'" | grep -q 1 || "${PSQL[@]}" -d postgres -c "create database ${DB};"
"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/local-stack/bootstrap.sql"

ANON=$(node "$ROOT/scripts/local-stack/jwt.mjs" "$SECRET" anon)
SERVICE=$(node "$ROOT/scripts/local-stack/jwt.mjs" "$SECRET" service_role)

# 1) GoTrue (aplica sus propias migraciones del esquema auth)
( cd "$BIN" && \
  GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 \
  GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:auth-admin-local@127.0.0.1:5432/${DB}?search_path=auth&sslmode=disable" \
  GOTRUE_DB_MIGRATIONS_PATH="$BIN/migrations" GOTRUE_SITE_URL=http://localhost:3000 GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" \
  GOTRUE_JWT_SECRET="$SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_DISABLE_SIGNUP=false GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 \
  GOTRUE_LOG_LEVEL=warn nohup "$BIN/auth" > "$LOG/auth.log" 2>&1 & echo $! > "$LOG/auth.pid" )
for i in $(seq 1 60); do curl -sf http://127.0.0.1:9999/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:9999/health >/dev/null || { echo "GoTrue no inició (ver $LOG/auth.log)"; exit 1; }

# 2) Migraciones y seeds de RUNNER 360 (si todavía no se aplicaron)
if ! "${PSQL[@]}" -d "$DB" -tc "select to_regclass('public.profiles')" | grep -q profiles; then
  for f in "$ROOT"/supabase/migrations/*.sql; do echo "→ $(basename "$f")"; "${PSQL[@]}" -d "$DB" -f "$f"; done
  for f in "$ROOT"/supabase/seed/*.sql; do echo "→ seed $(basename "$f")"; "${PSQL[@]}" -d "$DB" -f "$f"; done
fi

# 3) PostgREST
cat > "$LOG/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:authenticator-local@127.0.0.1:5432/${DB}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${SECRET}"
server-host = "127.0.0.1"
server-port = 3001
CONF
nohup "$BIN/postgrest" "$LOG/postgrest.conf" > "$LOG/postgrest.log" 2>&1 &
echo $! > "$LOG/postgrest.pid"
# 4) Gateway estilo Supabase
nohup node "$ROOT/scripts/local-stack/gateway.mjs" > "$LOG/gateway.log" 2>&1 &
echo $! > "$LOG/gateway.pid"
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:54321/rest/v1/" -H "apikey: $ANON" -H "authorization: Bearer $ANON" >/dev/null && break; sleep 1; done

cat > "$LOG/env.local" <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${ANON}
SUPABASE_SECRET_KEY=${SERVICE}
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV
echo "Backend local listo. Variables en $LOG/env.local"
