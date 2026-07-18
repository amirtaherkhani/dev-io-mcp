---
name: dev-io
description: Manage the dev.io MCP post workflow. Use for /dev.io or $dev-io commands to publish conversation results, list posts, read Markdown, inspect DEV.to metrics, or record local post events.
---

# dev.io MCP Workflow

Use the configured `dev-io` MCP server. Do not shell out to edit `posts/` when an MCP tool can perform the operation.

## Command routing

Interpret these command forms as follows:

| User command | MCP action |
| --- | --- |
| `/dev.io publish ...`, `/dev.io post ...`, `$dev-io publish ...` | `publish_post` |
| `/dev.io list`, `/dev.io list posts`, `$dev-io list posts` | `list_posts` |
| `/dev.io read <file>`, `/dev.io show <file>` | `read_post` |
| `/dev.io info <file>`, `/dev.io stats <file>` | `get_post_info` |
| `/dev.io view <file>`, `/dev.io like <file>`, `/dev.io comment <file>` | `record_post_event` |

## Publish/post

1. Extract the useful result, decisions, implementation details, and verification evidence from the current conversation or supplied document.
2. Remove API keys, tokens, passwords, private data, and unrelated transcript noise.
3. If the user did not provide a title, create a specific factual title.
4. Call `publish_post` with `title`, `summary`, and optional `conversation`, `source`, `topic`, and lowercase `tags`.
5. Report the local Markdown file and the `remote` result separately. Only say that a DEV.to article was created when `remote.published` is `true` and the response includes an article ID or URL.

Example intent:

```text
/dev.io publish this conversation as a post titled "Deploy an MCP Server to Kubernetes"
```

## List/read/info

- Use `list_posts` for a collection. Do not invent posts or metrics.
- Use `read_post` when the user asks for the Markdown content.
- Use `get_post_info` for file size, timestamps, local metrics, and the optional DEV.to snapshot.
- Ask for the file name when a command such as `info` is ambiguous.

## Events and metrics

Use `record_post_event` only when the user explicitly asks to record a local event. Valid events are `view`, `like`, `bookmark`, `share`, and `comment`. DEV.to metrics are read from the remote article snapshot; local events are separate and must not be presented as DEV.to reactions.

## Safety

- Publishing is a side effect. If the user asks for a public post but has not supplied enough content, ask for the missing title or summary before calling the tool.
- Never include secrets in a post or tool argument.
- Never claim that the unrelated `dev.io` website received a post. The configured remote publisher targets DEV.to/Forem only when `DEV_TO_PUBLISH=true`.
- Prefer a concise result with the file name, remote article URL, and metrics when available.
