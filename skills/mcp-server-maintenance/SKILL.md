# MCP Server Maintenance

Use this skill when changing tools, resources, transport, schemas, or server behavior.

## Contracts

Do not rename or silently change the meaning of existing tools:

- `publish_post`
- `list_posts`
- `read_post`
- `get_post_info`
- `record_post_event`

Do not change these resource URIs without updating all documentation and host configuration:

- `dev-io://post-template`
- `dev-io://posts`
- `dev-io://posts/metrics`

## Implementation rules

- Use the official `@modelcontextprotocol/sdk` package already declared in `package.json`.
- Keep schemas explicit and validate user-controlled arguments.
- Preserve the `posts/` path traversal protection.
- Return MCP `content` with concise, machine-readable JSON for data tools.
- Use `console.error` only for diagnostics because stdout is the stdio protocol channel.
- Keep local filesystem behavior independent from the optional remote adapter.

## Change checklist

- Update `README.md` when a tool, resource, environment variable, or host configuration changes.
- Update `docs/skills.md` or `docs/roles.md` when project responsibilities change.
- Add or update a smoke test for changed MCP behavior.
- Run `npm run lint` and `npm run build`.
