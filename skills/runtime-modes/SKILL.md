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

## Local image lifecycle

This project overrides the general local deployment retention default: after a
successful rollout, keep exactly one `dev-io-mcp` image—the image currently
deployed.

1. Confirm the Kubernetes context is Rancher Desktop and the registry is
   `localhost:5001`.
2. Before building, collect image references from every project pod and inspect
   the local containerd store and local registry for
   `localhost:5001/dev-io-mcp`.
3. Remove old `dev-io-mcp` images that are not referenced by an active pod.
   Keep the running image until the new rollout has passed verification.
4. Build and push a new immutable timestamped tag with `nerdctl`. Never use or
   overwrite `latest`.
5. Render and apply `charts/dev-io-mcp/` with the new repository and tag, then
   wait for the rollout.
6. Verify `/healthz`, `/readyz`, and an MCP `initialize` request to `POST /mcp`.
7. Only after verification succeeds, remove the former deployed image and any
   other stale `dev-io-mcp` images from both the local containerd store and the
   local registry. Confirm that the newly deployed image is the only retained
   project image.

Never run a global image prune. Cleanup must be scoped to `dev-io-mcp`, and no
image referenced by an active pod may be removed. If deployment or verification
fails, retain both the running image and the failed image for rollback and
diagnosis; report the exception instead of forcing the one-image policy.

## Verification

```bash
npm run lint
npm run build
helm lint charts/dev-io-mcp
helm template dev-io-mcp charts/dev-io-mcp --namespace dev-io
```

For HTTP mode, verify both health endpoints and send an MCP `initialize` request to `/mcp`.
