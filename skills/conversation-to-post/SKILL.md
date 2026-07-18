# Conversation To Post

Use this skill when a user asks to publish, summarize, or document an AI conversation as a dev.io post.

## Inputs

- Conversation transcript or the current task result.
- Optional title, author, source, topic, and tags.

## Procedure

1. Identify the useful result, decisions, implementation details, and verification evidence.
2. Remove secrets, tokens, credentials, personal data, and irrelevant transcript noise.
3. Write a specific title and a factual summary.
4. Put longer context in `conversation`; keep the summary readable without it.
5. Use `publish_post` with explicit `title` and `summary`.
6. Confirm the returned file path and read the generated file with `read_post` if validation is needed.

## Post rules

- Use `source: ai-conversation` unless the user provides a more accurate source.
- Use a topic that describes the result, not the model brand.
- Prefer 2-5 lowercase, stable tags such as `mcp`, `typescript`, `codex`, or `claude`.
- Never include credentials or unreviewed private conversation content.
- Publishing writes to the Kubernetes-backed Markdown volume and optionally publishes to DEV.to when `DEV_TO_PUBLISH=true` is configured and the verified DEV.to/Forem adapter reports success.

## Example tool intent

```text
publish_post({
  title: "Add MCP publishing workflow",
  summary: "Implemented and verified a Kubernetes-hosted Streamable HTTP MCP server that writes AI conversation results as Markdown posts.",
  conversation: "Relevant decisions and test evidence...",
  source: "ai-conversation",
  topic: "mcp-publishing",
  tags: ["mcp", "typescript", "claude", "codex"]
})
```
