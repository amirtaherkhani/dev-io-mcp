# Runtime Modes

Use this skill when changing standalone, HTTP, Docker, Compose, or Kubernetes behavior.

## Mode contract

| Mode | Transport | Entry point | State |
| --- | --- | --- | --- |
| Standalone | MCP stdio | `npm start` | Local `posts/` and `data/` |
| HTTP | Streamable HTTP | `MCP_TRANSPORT=http npm start` | Local `posts/` and `data/` |
| Docker | Streamable HTTP | `docker compose up` | Mounted `posts/` and `data/` |
| Kubernetes | Streamable HTTP | `kubectl apply -k deploy/k8s/overlays/local` | PVC-backed `posts/` and `data/` |

## Rules

- Keep stdio as the default so existing Claude and Codex configurations continue to work.
- Keep the HTTP endpoint at `/mcp` and health endpoints at `/healthz` and `/readyz`.
- Bind HTTP to `0.0.0.0` only inside Docker or Kubernetes; use loopback for local manual HTTP testing.
- Do not expose the MCP service publicly without authentication, network controls, and a reviewed threat model.
- Do not use `emptyDir` for production posts or metrics unless data loss is explicitly acceptable.
- Do not deploy a local image to a remote cluster; use an immutable registry tag or digest.

## Verification

```bash
npm run lint
npm run build
kubectl kustomize deploy/k8s/overlays/local
kubectl apply --dry-run=client -k deploy/k8s/overlays/local
docker build -t dev-io-mcp:local .
```

For HTTP mode, verify both health endpoints and send an MCP `initialize` request to `/mcp`.
