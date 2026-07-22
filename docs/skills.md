# Project Skills

These are the practical skills the project expects from a contributor or agent.

## Core skills

- TypeScript and Node.js
- MCP server development
- Markdown authoring
- File system based content publishing
- Basic JSON schema validation

## Agent skills

| Skill file | Scope | Why it matters |
| --- | --- | --- |
| `skills/conversation-to-post/SKILL.md` | Summarize AI conversations and prepare publishable posts | Keeps generated content safe and publish-ready |
| `skills/mcp-server-maintenance/SKILL.md` | Preserve MCP tools, resources, schemas, and transport behavior | Prevents contract regressions across Claude/Codex hosts |
| `skills/metrics-adapter/SKILL.md` | Maintain local metrics and optional remote adapter logic | Keeps event counts and sync behavior reliable |
| `skills/verify-mcp-server/SKILL.md` | Run static checks and MCP smoke tests | Catches protocol issues before release |
| `skills/runtime-modes/SKILL.md` | Maintain Kubernetes-only HTTP deployment and ingress | Ensures HTTPS, TLS, and PVC-backed state remain consistent |
| `/Users/mac/.codex/skills/dev-io/SKILL.md` | Route `/dev.io` and `$dev-io` commands to MCP tools | Keeps command intent and tool mapping correct |

## MCP tool capability map

| Capability | Tool | Scope |
| --- | --- | --- |
| Publish | `publish_post` | local + optional remote publish (`publish_to_remote`) |
| Listing | `list_posts` | local, remote, both |
| Read | `read_post` | local markdown |
| Info | `get_post_info` | local file metadata + local metrics |
| Search | `search_post` | local, remote, both |
| Summarize | `summarize_post` | local or remote |
| Related content | `find_related_posts` | local or remote |
| Compare | `compare_posts` | local or remote |
| Update | `update_post` | local or remote |
| Delete | `delete_post` | local or remote |
| List comments | `list_post_comments` | local threaded comments or remote DEV.to read-only comments |
| Add comment | `add_post_comment` | local Markdown post |
| Reply to comment | `reply_post_comment` | local Markdown post |

## Runtime modes

- Kubernetes: Helm chart with Traefik Ingress, HTTPS, and PVC-backed state.

## Workflows

- Read an AI conversation transcript.
- Summarize the useful outcome.
- Convert the result into a publishable dev.io post.
- Save the post as Markdown.
- Expose the saved content back through MCP resources.

## Host commands

| Host | Example command | Tool target |
| --- | --- | --- |
| Claude Code | `/dev.io publish ...` | `publish_post` |
| Claude Code | `/dev.io list`, `/dev.io search`, `/dev.io summarize`, `/dev.io related`, `/dev.io compare` | `list_posts`, `search_post`, `summarize_post`, `find_related_posts`, `compare_posts` |
| Claude Code | `/dev.io update`, `/dev.io delete`, `/dev.io read`, `/dev.io info` | `update_post`, `delete_post`, `read_post`, `get_post_info` |
| Claude Code | `/dev.io comments`, `/dev.io add comment`, `/dev.io reply` | `list_post_comments`, `add_post_comment`, `reply_post_comment` |
| Codex | `$dev-io publish ...` | `publish_post` |
| Codex | `$dev-io list`, `$dev-io search`, `$dev-io summarize`, `$dev-io related`, `$dev-io compare` | `list_posts`, `search_post`, `summarize_post`, `find_related_posts`, `compare_posts` |
| Codex | `$dev-io update`, `$dev-io delete`, `$dev-io show`, `$dev-io info` | `update_post`, `delete_post`, `read_post`, `get_post_info` |
| Codex | `$dev-io comments`, `$dev-io add comment`, `$dev-io reply` | `list_post_comments`, `add_post_comment`, `reply_post_comment` |
- Both hosts connect to `https://dev-io-mcp.dev.local/mcp`.

## Quality bar

- Keep output deterministic.
- Prefer plain Markdown over custom formats.
- Keep post content in `posts/` and runtime metrics/comments in `data/`.
- Return clear file paths and timestamps from tools.
