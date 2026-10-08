#!/usr/bin/env bash
# Backend Supabase mínimo SIN Docker, para desarrollo y pruebas E2E locales:
# PostgreSQL local + GoTrue (Auth) + PostgREST + gateway Node en http://127.0.0.1:54321.
# Requiere binarios de PostgreSQL y descarga GoTrue/PostgREST de GitHub Releases la primera vez.
# NO es un entorno de producción. Con Docker disponible, preferí `supabase start`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="${LOCAL_BACKEND_DIR:-$ROOT/.local-backend}"
# LOCAL_BACKEND_SKIP_SCHEMA=1 deja la base vacía (como un proyecto Supabase nuevo), para probar instaladores.
SKIP_SCHEMA="${LOCAL_BACKEND_SKIP_SCHEMA:-0}"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
PGPORT="${PGPORT:-54322}"
GOTRUE_VERSION="${GOTRUE_VERSION:-v2.177.0}"
POSTGREST_VERSION="${POSTGREST_VERSION:-v12.2.3}"
JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-at-least-32-characters-long}"
RUN_AS=(); [ "$(id -u)" = "0" ] && RUN_AS=(runuser -u postgres --)
mkdir -p "$DIR/bin" "$DIR/logs"

if [ ! -x "$DIR/bin/auth" ]; then
  curl -sSL "https://github.com/supabase/auth/releases/download/$GOTRUE_VERSION/auth-$GOTRUE_VERSION-x86.tar.gz" | tar -xz -C "$DIR/bin"
fi
if [ ! -x "$DIR/bin/postgrest" ]; then
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" | tar -xJ -C "$DIR/bin"
fi

# Idempotente: si quedaron procesos de una ejecución anterior, se reinician.
for p in auth postgrest gateway; do
  if [ -f "$DIR/$p.pid" ]; then kill "$(cat "$DIR/$p.pid")" 2>/dev/null || true; rm -f "$DIR/$p.pid"; fi
done

FRESH=0
if [ ! -d "$DIR/pg" ]; then
  FRESH=1
  mkdir -p "$DIR/pg"; [ "$(id -u)" = "0" ] && chown -R postgres "$DIR/pg" "$DIR/logs"
  "${RUN_AS[@]}" initdb -D "$DIR/pg" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
fi
if ! "${RUN_AS[@]}" pg_ctl -D "$DIR/pg" status >/dev/null 2>&1; then
  "${RUN_AS[@]}" pg_ctl -D "$DIR/pg" -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DIR/logs/pg.log" -w start >/dev/null
fi
PSQL=(psql -h 127.0.0.1 -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

if [ "$FRESH" = "1" ]; then
  "${PSQL[@]}" -f "$ROOT/scripts/local-backend/init-roles.sql"
fi

export GOTRUE_DB_DRIVER=postgres
export DATABASE_URL="postgres://supabase_auth_admin:local-dev-only@127.0.0.1:$PGPORT/postgres?sslmode=disable"
export GOTRUE_DB_NAMESPACE=auth API_EXTERNAL_URL="http://127.0.0.1:54321/auth/v1"
export GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_SITE_URL="${SITE_URL:-http://localhost:3000}"
export GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**,http://127.0.0.1:3000/**"
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_DISABLE_SIGNUP=false
export GOTRUE_DB_MIGRATIONS_PATH="$DIR/bin/migrations"
export GOTRUE_PASSWORD_MIN_LENGTH=10 GOTRUE_LOG_LEVEL=warn GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
"$DIR/bin/auth" migrate > "$DIR/logs/auth-migrate.log" 2>&1
nohup "$DIR/bin/auth" serve > "$DIR/logs/auth.log" 2>&1 &
echo $! > "$DIR/auth.pid"
until curl -sf http://127.0.0.1:9999/health >/dev/null; do sleep 1; done

if [ "$FRESH" = "1" ] && [ "$SKIP_SCHEMA" != "1" ]; then
  for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
  for f in "$ROOT"/supabase/seed/*.sql; do "${PSQL[@]}" -f "$f"; done
fi

cat > "$DIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:local-dev-only@127.0.0.1:$PGPORT/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 54323
server-host = "127.0.0.1"
CONF
nohup "$DIR/bin/postgrest" "$DIR/postgrest.conf" > "$DIR/logs/postgrest.log" 2>&1 & echo $! > "$DIR/postgrest.pid"
nohup node "$ROOT/scripts/local-backend/gateway.mjs" > "$DIR/logs/gateway.log" 2>&1 & echo $! > "$DIR/gateway.pid"
until curl -sf http://127.0.0.1:54321/rest/v1/ -o /dev/null; do sleep 1; done

node "$ROOT/scripts/local-backend/jwt.mjs" "$JWT_SECRET" > "$DIR/keys.env"
# shellcheck disable=SC1091
source "$DIR/keys.env"
cat <<INFO
Backend local listo (solo desarrollo):
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
Las claves también quedaron en .local-backend/keys.env
INFO
