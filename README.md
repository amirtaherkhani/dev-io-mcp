# dev.io MCP Server

This repository provides a small MCP server that works with any MCP host, including Claude and Codex-compatible clients.

It focuses on one workflow:

1. Capture an AI conversation summary.
2. Turn it into a Markdown post.
3. Store the post locally under `posts/`.
4. Provide a list/read API through MCP resources.
5. Track post metrics like views, likes, bookmarks, shares, and comments.

## What it exposes

- `publish_post` tool: write a Markdown post to `posts/`
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

```bash
npm start
```

## Connect from an MCP host

Use stdio transport. Example Claude or Codex host config:

```json
{
  "mcpServers": {
    "dev-io": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/dev.io/dist/index.js"]
    }
  }
}
```

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
