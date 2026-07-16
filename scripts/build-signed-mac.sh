#!/bin/bash
set -euo pipefail

# Building a signed release directly in this project directory fails
# codesign with "resource fork, Finder information, or similar detritus not
# allowed" -- when run inside this sandboxed dev environment, every file
# written here (regardless of content, even a trivial `echo` redirect)
# picks up a com.apple.provenance extended attribute that cannot be
# stripped from within the same sandbox, and codesign rejects any file
# that carries it. This is specific to this tool-mediated environment, not
# a general macOS or Electron issue -- a normal unsandboxed terminal does
# not hit this.
#
# Workaround: build in a scratch /tmp directory instead, then copy back
# only the sealed .dmg/.zip artifacts -- never the loose .app bundle,
# which gets re-tainted by the act of copying it back through this same
# sandbox. The .dmg/.zip are opaque containers; copying the container
# file doesn't touch the signed bytes sealed inside it.
#
# Usage:
#   APPLE_SIGNING_IDENTITY="Your Name (TEAMID)" \
#   APPLE_API_KEY=/path/to/AuthKey_XXXX.p8 \
#   APPLE_API_KEY_ID=XXXX \
#   APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
#   ./scripts/build-signed-mac.sh

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$(mktemp -d /tmp/transmission-build-XXXXXX)"

echo "Building in $BUILD_DIR ..."
rsync -a --exclude node_modules --exclude dist --exclude .git "$PROJECT_DIR/" "$BUILD_DIR/"

(
  cd "$BUILD_DIR"
  npm install
  npm run build
)

mkdir -p "$PROJECT_DIR/dist"
cp "$BUILD_DIR"/dist/*.dmg "$BUILD_DIR"/dist/*.zip "$PROJECT_DIR/dist/"

echo "Signed artifacts copied to $PROJECT_DIR/dist/"
rm -rf "$BUILD_DIR"
