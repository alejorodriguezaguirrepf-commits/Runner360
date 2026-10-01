#!/usr/bin/env bash
LOG="${LOCAL_LOG_DIR:-/tmp/runner360-local}"
for pf in "$LOG"/*.pid; do [[ -f "$pf" ]] && kill "$(cat "$pf")" 2>/dev/null; rm -f "$pf"; done
echo "Backend local detenido."
