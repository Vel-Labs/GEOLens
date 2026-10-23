#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/dist"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
ZIP_NAME="geo-lens-extension-v$VERSION.zip"
mkdir -p "$OUT_DIR"
cd "$ROOT_DIR"
rm -f "$OUT_DIR/$ZIP_NAME"
zip -r "$OUT_DIR/$ZIP_NAME" manifest.json assets src docs README.md package.json scripts -x "*.DS_Store" "*/.git/*" "dist/*"
echo "Created $OUT_DIR/$ZIP_NAME"
