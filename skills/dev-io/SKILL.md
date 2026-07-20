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
| `/dev.io list`, `/dev.io list posts`, `/dev.io list local`, `/dev.io list offline` | `list_posts` with `source=local` |
| `/dev.io list remote`, `/dev.io list dev.to`, `/dev.io list dev.io` | `list_posts` with `source=remote` |
| `/dev.io list all`, `/dev.io list both` | `list_posts` with `source=both` |
| `/dev.io read <file>`, `/dev.io show <file>` | `read_post` |
| `/dev.io info <file>`, `/dev.io stats <file>` | `get_post_info` |
| `/dev.io view <file>`, `/dev.io like <file>`, `/dev.io bookmark <file>`, `/dev.io share <file>`, `/dev.io comment <file>` | `record_post_event` |
| `/dev.io search ...` | `search_post` |
| `/dev.io summarize <file-or-id>` | `summarize_post` |
| `/dev.io related <prompt>` | `find_related_posts` |
| `/dev.io compare <a> <b>` | `compare_posts` |
| `/dev.io update ...` | `update_post` |
| `/dev.io delete ...` | `delete_post` |

## Publish/post

1. Extract the useful result, decisions, implementation details, and verification evidence from the current conversation or supplied document.
2. Remove API keys, tokens, passwords, private data, and unrelated transcript noise.
3. If the user did not provide a title, create a specific factual title.
4. Format the post for human reading before calling `publish_post`.
5. Call `publish_post` with `title`, `summary`, and optional `conversation`, `source`, `topic`, lowercase `tags`, and `publish_to_remote` when the user explicitly asks for DEV.to publishing.
6. Report the local Markdown file and the `remote` result separately. Only say that a DEV.to article was created when `remote.published` is `true` and the response includes an article ID or URL.

## DEV.to publishing style

Use a reader-friendly DEV.to article format, not a raw transcript dump.

Recommended structure:

````md
# Clear, specific title

> One-sentence context or outcome.

## TL;DR

- ✅ What was achieved
- ⚠️ Important caveat or limitation
- 🔗 Where to find the result

## Why this matters

Explain the problem in plain language.

## How it works

Use short sections, tables, and code examples.

## Example

```ts
console.log("Always use fenced code blocks with a language tag");
```

## Lessons learned

- Practical takeaway
- Tradeoff
- Next step
````

Formatting rules:

- Use emoji sparingly to improve scanning: ✅ for done, ⚠️ for warnings, 🔍 for inspection, 🚀 for deployment/publish, 🧪 for tests, 💡 for tips.
- Use `##` headings for major sections and `###` for subtopics.
- Use tables for comparisons, feature lists, command maps, metrics, and status reports.
- Put all commands and code in fenced code blocks with a language tag such as `bash`, `ts`, `json`, `yaml`, `md`, or `text`.
- Use inline code for filenames, env vars, API names, commands, and tool names.
- Prefer short paragraphs and bullet lists over long blocks of prose.
- Add a `TL;DR` near the top for long posts.
- Include verification evidence when publishing technical work.
- End with practical next steps only when they are real and useful.
- Do not include secrets, full raw logs, unrelated chat, or private debugging traces.

Interactive publishing flow:

1. Draft the post in the style above.
2. If the user asked for public DEV.to publishing, briefly show the title, tags, and summary before calling the tool when the content is ambiguous or high-impact.
3. If the user says publish/post directly and the content is sufficient, call `publish_post`.
4. Set `publish_to_remote=true` only when the user explicitly asks to publish to DEV.to and the server is configured for it.

Example intent:

```text
/dev.io publish this conversation as a post titled "Deploy an MCP Server to Kubernetes"
```

## List/read/info

- Use `list_posts` for a collection. Do not invent posts or metrics.
- Use `list_posts` with `source=remote` for the live DEV.to account list with real article IDs and remote metrics.
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
