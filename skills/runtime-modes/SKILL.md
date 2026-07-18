# Runtime Modes

Use this skill when changing the Kubernetes-only HTTP deployment.

## Mode contract

| Mode | Transport | Entry point | State |
| --- | --- | --- | --- |
| Kubernetes | Streamable HTTP | Helm chart | PVC-backed `posts/` and `data/` |

## Rules

- Keep the HTTP endpoint at `/mcp` and health endpoints at `/healthz` and `/readyz`.
- Bind HTTP to `0.0.0.0` inside the Kubernetes pod and expose it through the Traefik Ingress.
- Do not expose the MCP service publicly without authentication, network controls, and a reviewed threat model.
- Do not use `emptyDir` for production posts or metrics unless data loss is explicitly acceptable.
- Do not deploy a local image to a remote cluster; use an immutable registry tag or digest.

## Verification

```bash
npm run lint
npm run build
helm lint charts/dev-io-mcp
helm template dev-io-mcp charts/dev-io-mcp --namespace dev-io
```

For HTTP mode, verify both health endpoints and send an MCP `initialize` request to `/mcp`.
