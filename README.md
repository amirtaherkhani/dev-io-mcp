# dev.io MCP Server

This repository provides a small MCP server that works with any MCP host, including Claude and Codex-compatible clients.

It focuses on one workflow:

1. Capture an AI conversation summary.
2. Turn it into a Markdown post.
3. Store the post under the Kubernetes PVC mounted at `posts/`.
4. Provide a list/read API through MCP resources.
5. Track post metrics like views, likes, bookmarks, shares, and comments.

## What it exposes

- `publish_post` tool: write a Markdown post to `posts/` and optionally publish it to DEV.to
- `list_posts` tool: enumerate stored posts
- `read_post` tool: read a single post
- `get_post_info` tool: read file metadata and stored metrics
- `record_post_event` tool: increment views, likes, bookmarks, shares, or comments
- `post_template` resource: reusable Markdown structure
- `post_metrics` resource: metrics snapshot for all posts

## Kubernetes-only deployment

```bash
npm ci
npm run lint
npm run build
```

The Dockerfile is retained only as the Kubernetes image-build input. There is
no standalone, Compose, or local MCP runtime.

The Kubernetes server exposes:

- `POST /mcp`: Streamable HTTP MCP endpoint
- `GET /healthz`: liveness check
- `GET /readyz`: readiness check

The canonical deployment is the Helm chart:

```bash
helm lint ./charts/dev-io-mcp
helm upgrade --install dev-io-mcp ./charts/dev-io-mcp \
  --namespace dev-io \
  --create-namespace \
  --set image.repository=localhost:5001/dev-io-mcp \
  --set image.tag=20260718-193244 \
  --set devTo.publish=true \
  --set devTo.existingSecret=dev-to-api \
  --set devTo.existingSecretKey=api-key \
  --set ingress.enabled=true \
  --set ingress.className=traefik \
  --set ingress.hosts[0].host=dev-io-mcp.dev.local \
  --set ingress.tls[0].secretName=local-dev-tls
```

The chart uses PVCs for `posts/` and `data/`, Traefik for ingress, and the
existing platform wildcard certificate `local-dev-tls` for HTTPS.

MCP address:

```text
https://dev-io-mcp.dev.local/mcp
```

For a public deployment, replace `dev-io-mcp.dev.local` with a real DNS name
and provide a publicly trusted TLS Secret. See [`charts/dev-io-mcp/README.md`](charts/dev-io-mcp/README.md).

## Connect Codex and Claude

Both hosts connect to the Kubernetes HTTPS endpoint. The installers use
`DEV_IO_MCP_URL` when set, otherwise they use the local domain above.

```bash
npm run install:codex
npm run install:claude
```

### Codex CLI and Codex app

The installer registers the HTTPS URL in Codex:

```bash
codex mcp add dev-io --url https://dev-io-mcp.dev.local/mcp
```

Restart Codex after adding the server. Use `$dev-io` or natural language.

### Claude Code

Install the MCP server and the `/dev.io` command:

```bash
npm run install:claude
```

If Claude Code is already installed, the installer runs the equivalent of:

```bash
claude mcp add --scope user --transport http dev-io \
  https://dev-io-mcp.dev.local/mcp
```

The project command is stored at `.claude/commands/dev.io.md`. In Claude Code,
type `/dev.io` and choose a subcommand. Claude Code also supports project MCP
configuration through `.mcp.json`; use [`integrations/claude/mcp.json.example`](integrations/claude/mcp.json.example)
if you prefer a JSON config.

For Claude Desktop on macOS, merge the example's `mcpServers.dev-io` entry into
`~/Library/Application Support/Claude/claude_desktop_config.json`, then restart
Claude Desktop.

### Command examples

These commands are translated by the installed skill into MCP tool calls:

```text
/dev.io publish this conversation as "Deploy an MCP Server to Kubernetes"
/dev.io post the current document with tags mcp, kubernetes
/dev.io list posts
/dev.io show deploy-an-mcp-server-123.md
/dev.io info deploy-an-mcp-server-123.md
/dev.io like deploy-an-mcp-server-123.md
```

Tool mapping:

| Command | MCP tool |
| --- | --- |
| `publish`, `post` | `publish_post` |
| `list` | `list_posts` |
| `read`, `show` | `read_post` |
| `info`, `stats` | `get_post_info` |
| `view`, `like`, `bookmark`, `share`, `comment` | `record_post_event` |

## Post format

Posts are written as Markdown files with frontmatter-like metadata in the body:

```md
---
title: Example post
author: dev.io
source: ai-conversation
topic: communication-result
createdAt: 2026-07-18T00:00:00.000Z
views: 0
likes: 0
bookmarks: 0
shares: 0
comments: 0
tags: [mcp, claude, codex]
---

## Summary

...
```

## Project docs

- [`docs/skills.md`](docs/skills.md)
- [`docs/roles.md`](docs/roles.md)
- [`AGENTS.md`](AGENTS.md) for Codex-style project instructions
- [`CLAUDE.md`](CLAUDE.md) for Claude Code project instructions
- [`skills/`](skills/) for reusable agent workflows
- [`skills/dev-io/SKILL.md`](skills/dev-io/SKILL.md) for the shared host command workflow
- [`.claude/commands/dev.io.md`](.claude/commands/dev.io.md) for the Claude Code slash command

## How it talks to dev.io

The Kubernetes deployment stores Markdown posts and local metric events on the
PVC mounted at `data/`. The HTTP adapter is the boundary for a future remote
dev.io metrics service and is not enabled by default.

The optional remote sync endpoint is:

```text
POST /api/posts/metrics
```

Payload:

```json
{
  "file": "my-post.md",
  "metrics": {
    "views": 12,
    "likes": 5,
    "bookmarks": 2,
    "shares": 1,
    "comments": 0,
    "updatedAt": "2026-07-18T00:00:00.000Z"
  }
}
```

This repository does not claim an official dev.io SDK or public API. The
adapter is deliberately isolated behind an HTTP contract so it can be replaced
when a real dev.io API or SDK is identified. Markdown publishing remains
PVC-backed in Kubernetes.

## Publish to DEV.to

The official [DEV.to/Forem API](https://developers.forem.com/api/v0) supports creating articles with `POST /api/articles`. Enable it explicitly:

```bash
DEV_TO_PUBLISH=true
DEV_TO_API_BASE_URL=https://dev.to
DEV_TO_API_KEY=your-dev-to-api-key
DEV_TO_PUBLISHED=true
```

When enabled, `publish_post` still writes the local Markdown file, then sends the same Markdown body to the official DEV.to API. The result includes the remote article ID and URL, and the mapping is stored in `data/remote-posts.json`.

`get_post_info` uses that mapping to fetch remote DEV.to metrics such as page views, positive reactions, and comments. Local metrics remain separate because DEV.to does not provide a write API for arbitrary likes or views.

The API key must be generated in your DEV.to account settings and should be provided through a secret or environment variable, never committed to Git. The adapter also supports Forem-compatible instances by changing `DEV_TO_API_BASE_URL`.

This is a DEV.to/Forem integration. It is not proof that the unrelated `dev.io` domain exposes the same API.
