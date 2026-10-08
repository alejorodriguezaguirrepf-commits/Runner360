#!/bin/bash
# Crea el ícono "RUNNER 360" en el Escritorio y en el menú de aplicaciones (Linux).
set -euo pipefail
ROOT="$(cd "$(dirname "$(readlink -f "$0")")/../.." && pwd)"
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
[ -n "$DESKTOP_DIR" ] && [ "$DESKTOP_DIR" != "$HOME" ] || DESKTOP_DIR="$HOME/Desktop"
[ -d "$DESKTOP_DIR" ] || { [ -d "$HOME/Escritorio" ] && DESKTOP_DIR="$HOME/Escritorio"; }
mkdir -p "$DESKTOP_DIR" "$HOME/.local/share/applications"
chmod +x "$ROOT/scripts/launcher/iniciar-linux.sh"
ENTRY="[Desktop Entry]
Type=Application
Version=1.0
Name=RUNNER 360
Comment=Entrená. Medí. Progresá.
Exec=\"$ROOT/scripts/launcher/iniciar-linux.sh\"
Path=$ROOT
Icon=$ROOT/scripts/launcher/icons/runner360.png
Terminal=true
Categories=Sports;Utility;"
for f in "$DESKTOP_DIR/runner360.desktop" "$HOME/.local/share/applications/runner360.desktop"; do
  printf '%s\n' "$ENTRY" > "$f"
  chmod +x "$f"
  command -v gio >/dev/null 2>&1 && gio set "$f" metadata::trusted true 2>/dev/null || true
done
echo "Listo: ícono 'RUNNER 360' creado en $DESKTOP_DIR y en el menú de aplicaciones."
