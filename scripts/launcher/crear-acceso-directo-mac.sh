#!/bin/bash
# Crea "RUNNER 360.app" en el Escritorio (macOS), con ícono propio.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$HOME/Desktop/RUNNER 360.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
chmod +x "$ROOT/scripts/launcher/iniciar-mac.command"
cat > "$APP/Contents/MacOS/RUNNER360" <<SH
#!/bin/bash
open -a Terminal "$ROOT/scripts/launcher/iniciar-mac.command"
SH
chmod +x "$APP/Contents/MacOS/RUNNER360"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>RUNNER 360</string>
  <key>CFBundleDisplayName</key><string>RUNNER 360</string>
  <key>CFBundleIdentifier</key><string>com.runner360.launcher</string>
  <key>CFBundleExecutable</key><string>RUNNER360</string>
  <key>CFBundleIconFile</key><string>runner360</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1.0</string>
</dict></plist>
PLIST
# Ícono .icns a partir del PNG (herramientas incluidas en macOS).
ICONSET="$(mktemp -d)/runner360.iconset"
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$ROOT/scripts/launcher/icons/runner360.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  if [ $d -le 512 ]; then sips -z $d $d "$ROOT/scripts/launcher/icons/runner360.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null; fi
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/runner360.icns"
touch "$APP"
echo "Listo: 'RUNNER 360' creado en el Escritorio."
