# dev.io MCP Server

This repository provides a small MCP server that works with any MCP host, including Claude and Codex-compatible clients.

It focuses on one workflow:

1. Capture an AI conversation summary.
2. Turn it into a Markdown post.
3. Store the post locally under `posts/`.
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

## Install

```bash
npm install
npm run build
```

## Run

### Standalone mode

Standalone mode uses MCP stdio and is the default for Claude or Codex launched processes:

```bash
npm start
```

### HTTP mode

HTTP mode is used by Docker and Kubernetes deployments:

```bash
npm run start:http
```

The HTTP server exposes:

- `POST /mcp`: Streamable HTTP MCP endpoint
- `GET /healthz`: liveness check
- `GET /readyz`: readiness check

Default address: `http://127.0.0.1:3000/mcp`.

Runtime variables:

```bash
MCP_TRANSPORT=stdio|http
MCP_HOST=127.0.0.1
MCP_PORT=3000
```

## Docker mode

Build and run the HTTP container with persistent local post and metrics directories:

```bash
npm run docker:build
docker compose up
```

Connect an HTTP-capable MCP client to `http://127.0.0.1:3000/mcp`.

## Kubernetes mode

The Kubernetes deployment uses Streamable HTTP, health probes, a ClusterIP service, and PVCs for `posts/` and `data/`:

```bash
npm run docker:build
npm run k8s:render
npm run k8s:apply
kubectl -n dev-io rollout status deployment/dev-io-mcp
kubectl -n dev-io port-forward svc/dev-io-mcp 3000:3000
```

See [`deploy/k8s/README.md`](deploy/k8s/README.md) for registry images, storage classes, and remote-cluster guidance.

### Helm chart

The full configurable Helm chart is under [`charts/dev-io-mcp`](charts/dev-io-mcp):

```bash
npm run helm:lint
npm run helm:template
helm upgrade --install dev-io-mcp ./charts/dev-io-mcp \
  --namespace dev-io \
  --create-namespace \
  --set image.repository=dev-io-mcp \
  --set image.tag=local
```

The chart includes persistent volumes, health probes, optional Ingress, HPA, PDB, NetworkPolicy, service account hardening, and remote metrics Secret injection. Read [`charts/dev-io-mcp/README.md`](charts/dev-io-mcp/README.md) before installing.

## Connect to Codex and Claude

The recommended local connection is MCP stdio. The launcher loads the ignored
`.env` file, starts the built server, and keeps the DEV.to API key out of the
Codex or Claude configuration.

```bash
npm ci
npm run build
```

### Codex CLI and Codex app

Install the MCP server and the `$dev-io` skill into your Codex home:

```bash
npm run install:codex
codex mcp list
```

The installer registers this command:

```bash
codex mcp add dev-io -- /ABSOLUTE/PATH/TO/dev-io-mcp/scripts/run-mcp.sh
```

Restart Codex after adding the server. Codex uses the `dev-io` tools directly
and the skill can be invoked as `$dev-io`. Custom `/dev.io` slash commands are
provided for Claude Code; in Codex, use `$dev-io` or plain language such as
`publish this conversation as a post`.

### Claude Code

Install the MCP server and the `/dev.io` command:

```bash
npm run install:claude
```

If Claude Code is already installed, the installer runs the equivalent of:

```bash
claude mcp add --scope user --transport stdio dev-io -- \
  /ABSOLUTE/PATH/TO/dev-io-mcp/scripts/run-mcp.sh
```

The project command is stored at `.claude/commands/dev.io.md`. In Claude Code,
type `/dev.io` and choose a subcommand. Claude Code also supports project MCP
configuration through `.mcp.json`; use [`integrations/claude/mcp.json.example`](integrations/claude/mcp.json.example)
if you prefer a JSON config.

For Claude Desktop on macOS, merge the example's `mcpServers.dev-io` entry into
`~/Library/Application Support/Claude/claude_desktop_config.json`, then restart
Claude Desktop.

### Kubernetes HTTP connection

The deployed HTTP server can also be connected to either host while a
port-forward is running:

```bash
kubectl port-forward -n dev-io svc/dev-io-mcp 3000:3000
```

Codex CLI:

```bash
codex mcp add dev-io-k8s --url http://127.0.0.1:3000/mcp
```

Claude Code:

```bash
claude mcp add --scope user --transport http dev-io-k8s http://127.0.0.1:3000/mcp
```

Use stdio for normal local work. Use the HTTP entry when you specifically want
the Kubernetes PVC-backed `posts/` and `data/` state.

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

The server currently has two modes:

- `local` mode: metrics are stored in `data/post-metrics.json`
- `remote` mode: set these env vars and the server will POST metric updates to your configured API

```bash
DEV_IO_API_BASE_URL=https://your-dev-io-domain.example
DEV_IO_API_TOKEN=your-token-if-needed
```

The remote sync endpoint is implemented as:

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

If your `dev.io` site already has an SDK, send me its package name or docs and I can swap the HTTP adapter to the official SDK.

This repository does not claim an official dev.io SDK or public API. The remote adapter is deliberately isolated behind an HTTP contract so it can be replaced when the real dev.io API or SDK is identified. Markdown publishing itself remains local until that contract is provided.

See [`.env.example`](.env.example) for the connection variables.

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
