#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

npm --prefix "$ROOT_DIR" run build

CLAUDE_SKILLS_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/dev-io"
CLAUDE_COMMANDS_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/commands"
mkdir -p "$CLAUDE_SKILLS_DIR"
mkdir -p "$CLAUDE_COMMANDS_DIR"
cp "$ROOT_DIR/skills/dev-io/SKILL.md" "$CLAUDE_SKILLS_DIR/SKILL.md"
cp "$ROOT_DIR/.claude/commands/dev.io.md" "$CLAUDE_COMMANDS_DIR/dev.io.md"

if command -v claude >/dev/null 2>&1; then
  claude mcp remove dev-io >/dev/null 2>&1 || true
  claude mcp add --scope user --transport stdio dev-io -- "$ROOT_DIR/scripts/run-mcp.sh"
  printf '\nInstalled dev-io MCP server and skill for Claude Code.\n'
else
  printf '\nClaude Code CLI was not found, so the skill was installed but MCP registration was skipped.\n'
  printf 'Run this after installing Claude Code:\n'
  printf '  claude mcp add --scope user --transport stdio dev-io -- %q\n' "$ROOT_DIR/scripts/run-mcp.sh"
fi

printf 'Skill: %s\n' "$CLAUDE_SKILLS_DIR/SKILL.md"
printf 'Command: %s\n' "$CLAUDE_COMMANDS_DIR/dev.io.md"
printf 'Command: /dev.io publish ... or /dev.io list\n'
