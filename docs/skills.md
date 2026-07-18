# Project Skills

These are the practical skills the project expects from a contributor or agent.

## Core skills

- TypeScript and Node.js
- MCP server development
- Markdown authoring
- File system based content publishing
- Basic JSON schema validation

## Agent skills

- `skills/conversation-to-post/SKILL.md`: summarize and publish safe conversation results.
- `skills/mcp-server-maintenance/SKILL.md`: preserve MCP tools, resources, schemas, and transport behavior.
- `skills/metrics-adapter/SKILL.md`: maintain local metrics and the optional remote adapter.
- `skills/verify-mcp-server/SKILL.md`: run static checks and MCP protocol smoke tests.
- `skills/runtime-modes/SKILL.md`: maintain the Kubernetes-only HTTP deployment and Ingress.
- `skills/dev-io/SKILL.md`: route `/dev.io` and `$dev-io` commands to MCP tools safely.

## Runtime modes

- Kubernetes: Helm chart with Traefik Ingress, HTTPS, and PVC-backed state.

## Workflows

- Read an AI conversation transcript.
- Summarize the useful outcome.
- Convert the result into a publishable dev.io post.
- Save the post as Markdown.
- Expose the saved content back through MCP resources.

## Host commands

- Claude Code: `/dev.io publish ...`, `/dev.io list`, `/dev.io show <file>`, and `/dev.io info <file>`.
- Codex: `$dev-io publish ...`, `$dev-io list`, `$dev-io show <file>`, and `$dev-io info <file>`.
- Both hosts connect to `https://dev-io-mcp.dev.local/mcp`.

## Quality bar

- Keep output deterministic.
- Prefer plain Markdown over custom formats.
- Avoid hidden side effects outside the `posts/` directory.
- Return clear file paths and timestamps from tools.
