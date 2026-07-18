# Project Roles

This file describes the roles used by the dev.io MCP project.

## MCP Host

The host is Claude, Codex, or another MCP-compatible client. It invokes tools and displays results to the user.

## Publisher

The publisher tool turns a conversation or AI output into a dev.io post and writes it to disk.

## Reader

The reader tool lists and reads previously published posts.

## Maintainer

The maintainer keeps the Markdown format, tool contracts, and folder structure stable over time.

## Suggested conventions

- `author`: the person or agent that owns the post
- `source`: where the conversation came from
- `topic`: the main theme of the post
- `status`: draft or published
