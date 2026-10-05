#!/usr/bin/env bash
set -euo pipefail

# --- helpers -----------------------------------------------------------------

usage() {
  echo "Updates the package.json dependencies only - does not install anything."
  echo "Usage: $0 <package[@version]> [--dev] [--path|-p <dir>]"
  echo "  Examples:"
  echo "    $0 react"
  echo "    $0 react@18"
  echo "    $0 @angular/core"
  echo "    $0 @angular/core@latest"
  echo "    $0 lodash --dev"
  echo "    $0 lodash --path /projects/my-app"
  echo "    $0 lodash -p ../other-project --dev"
  exit 1
}

die() { echo "Error: $1" >&2; exit 1; }

# --- args --------------------------------------------------------------------

[[ $# -lt 1 ]] && usage

RAW="$1"
shift

DEV_FLAG=""
PKG_JSON_DIR="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev|-D)
      DEV_FLAG="true"
      shift
      ;;
    --path|-p|-w)
      [[ $# -lt 2 ]] && die "--path/-p/-w requires an argument."
      PKG_JSON_DIR="$2"
      shift 2
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

# --- resolve and validate path -----------------------------------------------

PKG_JSON_DIR="$(realpath "$PKG_JSON_DIR" 2>/dev/null)" \
  || die "Path does not exist: $PKG_JSON_DIR"

[[ -d "$PKG_JSON_DIR" ]] \
  || die "Path is not a directory: $PKG_JSON_DIR"

PKG_JSON_FILE="${PKG_JSON_DIR}/package.json"

[[ -f "$PKG_JSON_FILE" ]] \
  || die "No package.json found in: $PKG_JSON_DIR"

# --- parse name and version --------------------------------------------------
# Handles: react, react@18, @scope/pkg, @scope/pkg@1.2.3

if [[ "$RAW" == @* ]]; then
  # Scoped package: @scope/name or @scope/name@version
  SCOPE_AND_NAME="${RAW#@}"                        # scope/name[@version]
  NAME_PART="${SCOPE_AND_NAME%%@*}"                # scope/name
  PKG_NAME="@${NAME_PART}"                         # @scope/name
else
  PKG_NAME="${RAW%%@*}"                            # name (strip @version)
fi

# Extract version specifier if provided
if [[ "$RAW" == *@* ]]; then
  AT_COUNT=$(tr -cd '@' <<< "$RAW" | wc -c)

  if [[ "$RAW" == @* && "$AT_COUNT" -ge 2 ]]; then
    # Scoped + version: @scope/name@version
    VERSION_SPEC="${RAW##*@}"
  elif [[ "$RAW" != @* && "$AT_COUNT" -ge 1 ]]; then
    # Plain + version: name@version
    VERSION_SPEC="${RAW##*@}"
  else
    VERSION_SPEC="latest"
  fi
else
  VERSION_SPEC="latest"
fi

# --- resolve exact version via npm show --------------------------------------

echo "Resolving ${PKG_NAME}@${VERSION_SPEC}..."
RESOLVED_VERSION=$(npm show "${PKG_NAME}@${VERSION_SPEC}" version 2>/dev/null | tail -1)

[[ -z "$RESOLVED_VERSION" ]] && die "Could not resolve '${PKG_NAME}@${VERSION_SPEC}'. Check the package name and version."

echo "Resolved → ${PKG_NAME}@${RESOLVED_VERSION}"

# --- build the npm pkg set key -----------------------------------------------

ESCAPED_NAME="${PKG_NAME//./\\.}"

if [[ -n "$DEV_FLAG" ]]; then
  FIELD="devDependencies"
else
  FIELD="dependencies"
fi

KEY="${FIELD}.${ESCAPED_NAME}"

# --- write to package.json ---------------------------------------------------

npm pkg set "${KEY}=^${RESOLVED_VERSION}" --prefix "$PKG_JSON_DIR"

echo "Updated ${PKG_JSON_FILE}: \"${PKG_NAME}\": \"^${RESOLVED_VERSION}\" in ${FIELD}"