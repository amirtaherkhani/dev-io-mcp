# Verify MCP Server

Use this skill after changing TypeScript, tool schemas, resources, transport code, or filesystem behavior.

## Static checks

```bash
npm run lint
npm run build
```

## Protocol smoke test

Start the built server and send newline-delimited JSON-RPC messages. At minimum verify:

1. `initialize` returns server name `dev-io` and the current package version.
2. `tools/list` includes all documented tools.
3. `resources/list` includes the registered resources.
4. `publish_post` creates a Markdown file under `posts/`.
5. `record_post_event` changes exactly one metric.
6. `get_post_info` returns file metadata and metrics.
7. `add_post_comment`, `reply_post_comment`, and `list_post_comments` preserve the local thread relationship.
8. Remote `list_post_comments` sends `GET /api/comments` with `a_id` and pagination parameters to a mock Forem API.

## Cleanup

Remove only the temporary post and metrics file created by the smoke test. Leave `posts/.gitkeep` and `data/.gitkeep` in place. Finish with:

```bash
git status --short
```

The worktree should contain only intentional source or documentation changes.
