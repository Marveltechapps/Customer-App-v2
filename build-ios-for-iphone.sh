#!/usr/bin/env bash
# Build the customer app on EAS (iOS) and download the .ipa into this script's directory.
# Prereqs: Node 20+, `brew install jq`, `npx eas-cli` (or global `eas`), and `eas login`.
# iPhone install: use a profile with "distribution": "internal" (e.g. preview) for ad hoc,
# or install via TestFlight / App Store for production store builds.
#
# Usage:
#   ./build-ios-for-iphone.sh              # uses EAS profile: production
#   ./build-ios-for-iphone.sh preview      # uses EAS profile: preview (internal dist)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROFILE="${1:-production}"
OUT_NAME="Selorg-ios-${PROFILE}-$(date +%Y%m%d-%H%M%S).ipa"
DEST="$SCRIPT_DIR/$OUT_NAME"

if ! command -v jq >/dev/null 2>&1; then
  echo "Missing jq. Install: brew install jq"
  exit 1
fi

EAS=(npx --yes eas-cli@latest)
if ! "${EAS[@]}" --version >/dev/null 2>&1; then
  echo "Could not run EAS CLI via npx eas-cli@latest"
  exit 1
fi

echo "Project: $SCRIPT_DIR"
echo "EAS iOS profile: $PROFILE"
echo "Output IPA: $DEST"
echo ""

# mktemp on macOS requires the template to end in at least six X's
BUILD_JSON="$(mktemp "$SCRIPT_DIR"/eas-build-out.XXXXXX)"
ERR_LOG="$(mktemp "$SCRIPT_DIR"/eas-build-err.XXXXXX)"
VIEW_JSON="$(mktemp "$SCRIPT_DIR"/eas-view.XXXXXX)"
cleanup() { rm -f "$BUILD_JSON" "$ERR_LOG" "$VIEW_JSON" 2>/dev/null || true; }
trap cleanup EXIT

# JSON on stdout; status messages on stderr
if ! "${EAS[@]}" build --platform ios --profile "$PROFILE" --non-interactive --wait --json >"$BUILD_JSON" 2>"$ERR_LOG"; then
  cat "$ERR_LOG" >&2
  echo "EAS build failed."
  exit 1
fi
cat "$ERR_LOG" >&2 || true

BUILD_ID="$(jq -r '
  if type == "array" then (if length > 0 then (.[0].id // .[0].build.id // empty) else empty end)
  else (.build.id // .id // .buildId // empty) end
' "$BUILD_JSON")"
if [[ -z "${BUILD_ID:-}" || "$BUILD_ID" == "null" ]]; then
  echo "Could not read build id from EAS output." >&2
  exit 1
fi
echo "Build id: $BUILD_ID"

if ! "${EAS[@]}" build:view "$BUILD_ID" --json >"$VIEW_JSON" 2>/dev/null; then
  echo "Could not load build details. Open: https://expo.dev  (build id: $BUILD_ID)" >&2
  exit 1
fi

# EAS may expose the app archive under different keys depending on CLI version
URL="$(
  jq -r '
    [
      .artifacts.buildUrl,
      .artifacts.url,
      .artifacts.applicationArchiveUrl
    ] | map(select(type == "string" and length > 0)) | first // empty
  ' "$VIEW_JSON"
)"

if [[ -z "$URL" || "$URL" == "null" ]]; then
  echo "No download URL in build:view JSON. Top-level keys:" >&2
  jq 'keys' "$VIEW_JSON" >&2 || true
  echo "Open the build page in Expo and download the application archive manually (build id: $BUILD_ID)." >&2
  exit 1
fi

echo "Downloading artifact..."
curl -fsSL -o "$DEST" "$URL"
echo "Saved:"
ls -lh "$DEST"
