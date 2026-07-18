---
description: Publish, list, read, inspect, or record metrics for dev.io MCP posts
argument-hint: <publish|post|list|read|show|info|stats|view|like|comment> [details]
---

Use the `dev-io` MCP server and the `dev-io` skill for this request.

Route the command from `$ARGUMENTS`:

- `publish` or `post`: summarize the current conversation or supplied document, redact secrets, and call `publish_post`.
- `list`: call `list_posts` and present the file names.
- `read` or `show`: call `read_post` for the requested file.
- `info` or `stats`: call `get_post_info` for the requested file.
- `view`, `like`, or `comment`: call `record_post_event` with the matching event.

For publishing, return the local file path and clearly separate local creation from a DEV.to result. Never claim remote publication unless the MCP response contains `remote.published: true` and an article ID or URL. Never expose API keys or private conversation data.
