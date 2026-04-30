#!/usr/bin/env bash
# scripts/package.sh — build clipcv and emit release/clipcv-v{version}.{zip,crx}
#
# Pre-flight: refuse to package if the manifest version equals the most recent
# v* git tag. The expectation is that every release bumps src/manifest.json
# before the package is built.
#
# Key handling: signs the .crx with $CRX_PRIVATE_KEY (PEM contents in env) if
# set; otherwise uses ./key.pem; otherwise generates a fresh RSA-2048 key at
# ./key.pem and signs with it. *.pem is gitignored — never commit the key.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

VERSION=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('src/manifest.json','utf8')).version)")
if [ -z "$VERSION" ]; then
  echo "package: failed to read version from src/manifest.json" >&2
  exit 1
fi

# Pre-flight: manifest version must differ from the most recent v* tag.
# CI sets SKIP_TAG_PREFLIGHT=1 because the v* tag is the trigger and already
# exists at HEAD with the intended release version — that is the legitimate
# release path, not a missed bump.
if [ -n "${SKIP_TAG_PREFLIGHT:-}" ]; then
  echo "package: SKIP_TAG_PREFLIGHT set, skipping tag pre-flight"
else
  LAST_TAG=$(git tag --list 'v*' --sort=-v:refname | head -1 || true)
  if [ -n "$LAST_TAG" ] && [ "$LAST_TAG" = "v${VERSION}" ]; then
    echo "package: manifest version ${VERSION} equals latest git tag ${LAST_TAG}" >&2
    echo "package: bump src/manifest.json before packaging" >&2
    exit 1
  fi
fi

echo "package: building clipcv v${VERSION}"
npm run build

if [ ! -f "${ROOT}/dist/manifest.json" ]; then
  echo "package: dist/manifest.json missing after build" >&2
  exit 1
fi
DIST_VERSION=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('dist/manifest.json','utf8')).version)")
if [ "$DIST_VERSION" != "$VERSION" ]; then
  echo "package: dist/manifest.json version ${DIST_VERSION} != src ${VERSION}" >&2
  exit 1
fi

mkdir -p "${ROOT}/release"
ZIP_PATH="${ROOT}/release/clipcv-v${VERSION}.zip"
CRX_PATH="${ROOT}/release/clipcv-v${VERSION}.crx"
PEM_PATH="${ROOT}/key.pem"

# Repackage zip from dist/ contents (manifest.json at root, no dist/ prefix).
rm -f "$ZIP_PATH"
( cd "${ROOT}/dist" && zip -r -q -X "$ZIP_PATH" . )

if [ ! -s "$ZIP_PATH" ]; then
  echo "package: zip step produced empty ${ZIP_PATH}" >&2
  exit 1
fi

# Pack .crx via pure-node helper (no third-party crypto deps).
rm -f "$CRX_PATH"
node "${ROOT}/scripts/pack-crx.mjs" "$ZIP_PATH" "$PEM_PATH" "$CRX_PATH"

if [ ! -s "$CRX_PATH" ]; then
  echo "package: crx step produced empty ${CRX_PATH}" >&2
  exit 1
fi

ZIP_BYTES=$(wc -c < "$ZIP_PATH" | tr -d ' ')
CRX_BYTES=$(wc -c < "$CRX_PATH" | tr -d ' ')
echo "package: ok"
echo "  zip: ${ZIP_PATH} (${ZIP_BYTES} bytes)"
echo "  crx: ${CRX_PATH} (${CRX_BYTES} bytes)"
