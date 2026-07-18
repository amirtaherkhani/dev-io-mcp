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
- `skills/runtime-modes/SKILL.md`: maintain standalone, HTTP, Docker, and Kubernetes modes.

## Runtime modes

- Standalone stdio: `npm start` for Claude/Codex process configuration.
- HTTP: `MCP_TRANSPORT=http npm start` for networked MCP clients.
- Docker: `npm run docker:build` and `docker compose up`.
- Kubernetes: `npm run k8s:render` and `npm run k8s:apply`.

## Workflows

- Read an AI conversation transcript.
- Summarize the useful outcome.
- Convert the result into a publishable dev.io post.
- Save the post as Markdown.
- Expose the saved content back through MCP resources.

## Quality bar

- Keep output deterministic.
- Prefer plain Markdown over custom formats.
- Avoid hidden side effects outside the `posts/` directory.
- Return clear file paths and timestamps from tools.
