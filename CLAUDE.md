# CLAUDE.md

## Purpose

This repository contains a Kubernetes-hosted TypeScript MCP server for converting Claude or Codex conversation results into Markdown posts under PVC-backed `posts/` storage.

## Working rules

- Read `AGENTS.md` and the applicable file in `skills/` before editing.
- Inspect the worktree before changing files. Preserve changes that are not part of the current task.
- Use `apply_patch` for manual edits.
- Keep TypeScript strict and keep generated `dist/` output out of source edits.
- Keep MCP responses deterministic and return useful file names, timestamps, and metrics.

## Publishing workflow

1. Extract the useful outcome from the conversation.
2. Redact secrets and private data.
3. Prepare a concise title, summary, topic, source, and tags.
4. Show or validate the proposed content before calling `publish_post` when the host supports confirmation.
5. Confirm the resulting Markdown file under `posts/`.

The `publish_post` tool writes to Kubernetes-backed storage and can optionally publish to DEV.to when `DEV_TO_PUBLISH=true` is configured. Do not imply that a website post was created without a verified remote API response.

DEV.to publishing is a separate explicit opt-in through `DEV_TO_PUBLISH=true`. It targets the official DEV.to/Forem article API, not an assumed `dev.io` API.

## Runtime

- Kubernetes only: Streamable HTTP behind Traefik at `https://dev-io-mcp.dev.local/mcp`.
- The Dockerfile is an image-build input for Kubernetes, not a local runtime.

The HTTP deployment must retain `/healthz`, `/readyz`, and `/mcp`.

## MCP and logging

The public tool names and resource URIs are documented in `AGENTS.md`. Do not write diagnostics with `console.log`; stdout carries MCP protocol messages. Use stderr instead.

## Checks

```bash
npm run lint
npm run build
```

For tool or resource changes, run an MCP initialization and `tools/list` smoke test. Clean up temporary posts and metrics after testing.

## Relevant skills

- `skills/conversation-to-post/SKILL.md`
- `skills/mcp-server-maintenance/SKILL.md`
- `skills/metrics-adapter/SKILL.md`
- `skills/verify-mcp-server/SKILL.md`
- `skills/runtime-modes/SKILL.md`
- `skills/dev-io/SKILL.md`

## Host commands

- Claude Code: use `/dev.io publish ...`, `/dev.io list`, `/dev.io show <file>`, or `/dev.io info <file>`.
- Codex: use `$dev-io publish ...`, `$dev-io list`, `$dev-io show <file>`, or `$dev-io info <file>`.
