#!/bin/bash
# RUNNER 360 - inicio local en Linux.
cd "$(dirname "$(readlink -f "$0")")/../.." || exit 1
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
if ! command -v node >/dev/null 2>&1; then
  echo "No se encontró Node.js. Instalalo desde https://nodejs.org (versión LTS)."; read -r -p "Enter para cerrar"; exit 1
fi
node scripts/launcher/runner360.mjs "$@" || read -r -p "Enter para cerrar"
