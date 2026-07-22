# Project Roles

This file describes the roles used by the dev.io MCP project.

## MCP Host

| Role | Responsibility | Primary toolset |
| --- | --- | --- |
| MCP Host | Invokes MCP tools and returns tool outputs to the user | all registered MCP tools/resources |
| Publisher | Converts conversation output into a publishable post and writes markdown | `publish_post` |
| Reader | Lists, searches, summarizes, and reads published content | `list_posts`, `search_post`, `summarize_post`, `read_post` |
| Editor | Updates or removes posts safely in local or remote mode | `update_post`, `delete_post` |
| Commenter | Reads comment threads and adds or replies to local post comments | `list_post_comments`, `add_post_comment`, `reply_post_comment` |
| Analyst | Compares topics/posts and finds related content for decision support | `find_related_posts`, `compare_posts` |
| Metrics Operator | Records local interaction events and validates sync behavior | `record_post_event`, `get_post_info`, `post_metrics` resource |
| Runtime Operator | Builds/deploys and verifies Kubernetes-only deployment, ingress, and TLS | chart/helm, health checks, deployment checks |

## Suggested conventions

| Field | Meaning |
| --- | --- |
| `author` | Person or agent that owns the post |
| `source` | Conversation source (`claude`, `codex`, `agent-session`, etc.) |
| `topic` | Main technical topic or thread |
| `status` | `draft` or `published` |
| `views` | Local metric counter (starts at 0) |
| `likes` | Local metric counter (starts at 0) |
