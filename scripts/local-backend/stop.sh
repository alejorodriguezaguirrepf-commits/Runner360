#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/.local-backend"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
for p in auth postgrest gateway; do [ -f "$DIR/$p.pid" ] && kill "$(cat "$DIR/$p.pid")" 2>/dev/null; rm -f "$DIR/$p.pid"; done
RUN_AS=(); [ "$(id -u)" = "0" ] && RUN_AS=(runuser -u postgres --)
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/pg" -m fast stop >/dev/null 2>&1 || true
echo "Backend local detenido. Para empezar de cero: rm -rf .local-backend/pg"
