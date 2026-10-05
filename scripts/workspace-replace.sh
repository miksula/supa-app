#!/usr/bin/env bash
set -euo pipefail

# Replace or revert "workspace:" version specifiers in package.json files
# across all workspace folders defined in root package.json.
#
# Usage:
#   ./scripts/workspace-replace.sh [--version|-v <version>]
#   ./scripts/workspace-replace.sh --revert|-r
#
# Defaults to "^0.0.0" if no version is provided.
# --revert restores "workspace:*" for @packages/ deps that have a non-workspace version.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_PKG="$ROOT_DIR/package.json"

VERSION="^0.0.0"
REVERT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version|-v)
      [[ $# -lt 2 ]] && { echo "Error: $1 requires a value." >&2; exit 1; }
      VERSION="$2"
      shift 2
      ;;
    --revert|-r)
      REVERT=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--version|-v <version>] [--revert|-r]" >&2
      exit 1
      ;;
  esac
done

# Read workspace globs from root package.json
WORKSPACE_GLOBS=$(node -e "
  const pkg = require('$ROOT_PKG');
  (pkg.workspaces || []).forEach(w => console.log(w));
")

COUNT=0

while IFS= read -r glob; do
  # Expand each glob relative to the repo root
  for dir in $ROOT_DIR/$glob; do
    PKG_FILE="$dir/package.json"
    [[ -f "$PKG_FILE" ]] || continue

    if [[ "$REVERT" == true ]]; then
      # Find @packages/ deps with a non-workspace version and restore workspace:*
      if grep -q '"@packages/[^"]*"' "$PKG_FILE" \
        && grep '"@packages/' "$PKG_FILE" | grep -qv '"workspace:'; then
        sed -i '' -E '/"@packages\/[^"]*":/s/: *"[^"]*"/: "workspace:*"/g' "$PKG_FILE"
        echo "Reverted: ${PKG_FILE#$ROOT_DIR/}"
        COUNT=$((COUNT + 1))
      fi
    else
      if grep -q '"workspace:[^"]*"' "$PKG_FILE"; then
        sed -i '' -E 's/"workspace:[^"]*"/"'"$VERSION"'"/g' "$PKG_FILE"
        echo "Updated: ${PKG_FILE#$ROOT_DIR/}"
        COUNT=$((COUNT + 1))
      fi
    fi
  done
done <<< "$WORKSPACE_GLOBS"

if [[ $COUNT -eq 0 ]]; then
  if [[ "$REVERT" == true ]]; then
    echo "No @packages/ deps to revert."
  else
    echo "No workspace: specifiers found."
  fi
else
  if [[ "$REVERT" == true ]]; then
    echo "Reverted @packages/ deps in $COUNT file(s) to \"workspace:*\"."
  else
    echo "Replaced workspace: specifiers in $COUNT file(s) with \"$VERSION\"."
  fi
fi
