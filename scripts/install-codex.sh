#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v codex >/dev/null 2>&1; then
  printf 'Codex CLI was not found on PATH. Install Codex CLI, then rerun this script.\n' >&2
  exit 1
fi

npm --prefix "$ROOT_DIR" run build

CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CODEX_HOME_DIR/skills/dev-io"
cp "$ROOT_DIR/skills/dev-io/SKILL.md" "$CODEX_HOME_DIR/skills/dev-io/SKILL.md"

# Replace only this project's reserved MCP entry so rerunning the installer is safe.
codex mcp remove dev-io >/dev/null 2>&1 || true
codex mcp add dev-io -- "$ROOT_DIR/scripts/run-mcp.sh"

printf '\nInstalled dev-io MCP server for Codex.\n'
printf 'Skill: %s\n' "$CODEX_HOME_DIR/skills/dev-io/SKILL.md"
printf 'Use: $dev-io publish/post <document>, $dev-io list posts, or $dev-io info <file>.\n'
