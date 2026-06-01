#!/usr/bin/env bash
# Local iOS build on this Mac (EAS Build --local → Xcode/CocoaPods on your machine).
# Writes an .ipa next to this script (same folder).
#
# Prerequisites:
#   - macOS with Xcode + Command Line Tools
#   - CocoaPods (pod)
#   - Node 20+
#   - `npm install` in this project
#   - `eas login` and Apple Developer access; run `eas credentials` if the first build fails on signing
#
# Usage:
#   ./build-ios-local.sh
#   ./build-ios-local.sh preview
#   ./build-ios-local.sh production --clear-cache
#   PROFILE=preview ./build-ios-local.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROFILE="${PROFILE:-production}"
ARGS=("$@")
if [[ ${#ARGS[@]} -gt 0 && "${ARGS[0]}" != -* && "${ARGS[0]}" =~ ^(preview|production|development)$ ]]; then
  PROFILE="${ARGS[0]}"
  ARGS=("${ARGS[@]:1}")
fi

OUT_NAME="Selorg-ios-local-${PROFILE}-$(date +%Y%m%d-%H%M%S).ipa"
DEST="$SCRIPT_DIR/$OUT_NAME"

EAS=(npx --yes eas-cli@latest)

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild not found. Install Xcode from the App Store." >&2
  exit 1
fi

if [[ -f ios/Podfile ]]; then
  if [[ ! -d ios/Pods ]]; then
    echo "Running pod install..."
    (cd ios && export LANG=en_US.UTF-8 && pod install)
  fi
fi

echo "Project:     $SCRIPT_DIR"
echo "EAS profile: $PROFILE"
echo "Output:      $DEST"
echo ""

# With `set -u`, empty "${ARGS[@]}" is an error on macOS Bash 3.2; only pass extras when present.
if [[ -n "${CI:-}" ]]; then
  if ((${#ARGS[@]} > 0)); then
    "${EAS[@]}" build --platform ios --profile "$PROFILE" --local --output "$DEST" --non-interactive "${ARGS[@]}"
  else
    "${EAS[@]}" build --platform ios --profile "$PROFILE" --local --output "$DEST" --non-interactive
  fi
else
  if ((${#ARGS[@]} > 0)); then
    "${EAS[@]}" build --platform ios --profile "$PROFILE" --local --output "$DEST" "${ARGS[@]}"
  else
    "${EAS[@]}" build --platform ios --profile "$PROFILE" --local --output "$DEST"
  fi
fi

echo ""
echo "Done. Artifact:"
ls -lh "$DEST"
