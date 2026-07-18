#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # The local .env is ignored by Git and is loaded only for this MCP process.
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ ! -f "$ROOT_DIR/dist/index.js" ]]; then
  printf 'Missing dist/index.js. Run npm run build first.\n' >&2
  exit 1
fi

exec node "$ROOT_DIR/dist/index.js" "$@"
