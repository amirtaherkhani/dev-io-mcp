# dev.io MCP Server

This repository provides a small MCP server that works with any MCP host, including Claude and Codex-compatible clients.

It focuses on one workflow:

1. Capture an AI conversation summary.
2. Turn it into a Markdown post.
3. Store the post locally under `posts/`.
4. Provide a list/read API through MCP resources.
5. Track post metrics and threaded local comments.

## What it exposes

- `publish_post` tool: write a Markdown post to `posts/`
- `list_posts` tool: enumerate local posts and optional remote DEV.to posts (`source`)
- `search_post` tool: keyword search on local and/or remote posts
- `summarize_post` tool: summarize local markdown or remote article content
- `find_related_posts` tool: find related posts using prompt/topic similarity
- `compare_posts` tool: compare two posts (local or remote)
- `update_post` tool: update local markdown or DEV.to article
- `delete_post` tool: remove local file or delete remote DEV.to post
- `read_post` tool: read a single local post
- `get_post_info` tool: read local file metadata and stored metrics
- `record_post_event` tool: increment views, likes, bookmarks, shares, or comments
- `list_post_comments` tool: list threaded local comments or public DEV.to article comments
- `add_post_comment` tool: add a comment to a local Markdown post
- `reply_post_comment` tool: reply to a local Markdown post comment
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

## Comments

Local post comments are stored as threaded records in `data/post-comments.json` on the data PVC. Adding a comment or reply also increments the post's local `comments` metric.
Deleting a local post removes its stored comments and metrics.

`list_post_comments` can read public DEV.to article comments through the documented Forem `GET /api/comments?a_id=<article-id>` endpoint. DEV.to does not expose API-key endpoints for creating comments or replies, so `add_post_comment` and `reply_post_comment` intentionally operate only on local Markdown posts.

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

## Command intent examples

- list posts locally: `source: "local"`
- list posts remotely: `source: "remote"` (requires `DEV_TO_PUBLISH=true`, `DEV_TO_API_KEY`)
- show post metrics by calling `get_post_info`
- list local comments with `list_post_comments` using `source: "local"` and `file`
- list DEV.to comments with `list_post_comments` using `source: "remote"` and `article_id`
- add and reply to local comments with `add_post_comment` and `reply_post_comment`
- publish and publish to DEV.to:

```json
{
  "title": "Example",
  "summary": "A short digest",
  "publish_to_remote": true
}
```

This repository does not claim an official dev.io SDK or public API. The remote adapter is deliberately isolated behind an HTTP contract so it can be replaced when the real dev.io API or SDK is identified. Markdown publishing itself remains local until that contract is provided.

See [`.env.example`](.env.example) for the connection variables.
