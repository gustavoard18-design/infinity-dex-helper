#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist/chrome"
ZIP="$ROOT/dist/infinity-dex-helper-chrome.zip"

rm -rf "$DIST"
mkdir -p "$DIST"

FILES=(
  background.js
  battle.html
  battle.js
  chart.html
  chart.js
  content.js
  interceptor.js
  hook.js
  manifest.json
  myPokemons.html
  myPokemons.js
  pokedex.html
  pokedex.js
  pixel-theme.css
)

for f in "${FILES[@]}"; do
  cp "$ROOT/$f" "$DIST/$f"
done

cp -r "$ROOT/icons" "$DIST/icons"
cp -r "$ROOT/components" "$DIST/components"
cp -r "$ROOT/data" "$DIST/data"

rm -f "$ZIP"
(cd "$DIST" && zip -rq "$ZIP" .)

echo "Built: $ZIP"
