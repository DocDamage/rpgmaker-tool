#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ -x "node_modules/.bin/electron" ]; then
  exec npm start
elif command -v xdg-open >/dev/null 2>&1; then
  exec xdg-open HybridTileStudio.html
elif command -v open >/dev/null 2>&1; then
  exec open HybridTileStudio.html
else
  printf '%s\n' 'Serve this folder over localhost and open HybridTileStudio.html in Chromium.'
fi
