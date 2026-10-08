#!/usr/bin/env bash
# Levanta un PostgreSQL efímero, aplica el shim de Supabase, las migraciones, los seeds
# y ejecuta las pruebas SQL de RLS/integridad. Requiere binarios de PostgreSQL (initdb, pg_ctl, psql).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
DATA="$ROOT/.db-test/data"
PORT="${DB_TEST_PORT:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then RUN_AS=(runuser -u postgres --); fi

rm -rf "$ROOT/.db-test" && mkdir -p "$DATA"
if [ "$(id -u)" = "0" ]; then chown -R postgres "$ROOT/.db-test"; fi

"${RUN_AS[@]}" initdb -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$ROOT/.db-test/pg.log" -w start >/dev/null
trap '"${RUN_AS[@]}" pg_ctl -D "$DATA" -m fast stop >/dev/null 2>&1 || true' EXIT

PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

echo "→ shim de Supabase"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migración $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
for f in "$ROOT"/supabase/seed/*.sql; do
  echo "→ seed $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do
  echo "→ prueba $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -f "$f"
done
echo "✓ Base de datos: migraciones, seeds y pruebas SQL OK"
