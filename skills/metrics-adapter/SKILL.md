# Metrics Adapter

Use this skill when working on views, likes, bookmarks, shares, comments, or remote dev.io synchronization.

## Local behavior

- Metrics are stored in `data/post-metrics.json`.
- A post is identified by its Markdown file name, not an arbitrary path.
- Supported events are `view`, `like`, `bookmark`, `share`, and `comment`.
- Every update refreshes `updatedAt`.

## Remote behavior

Remote synchronization is opt-in through:

```bash
DEV_IO_API_BASE_URL=https://your-dev-io-domain.example
DEV_IO_API_TOKEN=optional-token
```

The current adapter sends `POST /api/posts/metrics` with `{ file, metrics }`. Treat this as an integration boundary, not proof of an official dev.io API. Do not add a new endpoint or SDK dependency based on assumption alone.

## Safety and correctness

- Persist local metrics before attempting remote synchronization.
- Surface non-2xx remote responses as errors.
- Do not log bearer tokens or conversation content.
- Test the Kubernetes-backed metrics path and configured remote failure behavior.
- Do not commit `data/post-metrics.json`.
- Do not commit `data/remote-posts.json`; it is local runtime mapping state.
