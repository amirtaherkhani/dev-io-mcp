# dev-io-mcp Helm chart

This chart is the only supported runtime for the MCP server. It deploys
Streamable HTTP behind Traefik with PVC-backed post and metrics state.

## Image build

Build and push the image with the container runtime used by the cluster, then
deploy an immutable tag with Helm. The repository Dockerfile is not a local
runtime mode.

## Connect through HTTPS

MCP endpoint: `https://dev-io-mcp.dev.local/mcp`

The default local values use Traefik and the platform-provided wildcard TLS
Secret `local-dev-tls`. For another cluster, set `ingress.hosts` and
`ingress.tls` to the cluster's DNS name and TLS Secret.

Run the chart test:

```bash
helm test dev-io-mcp -n dev-io
```

## Remote image

Use an immutable tag or digest for a remote cluster:

```bash
helm upgrade --install dev-io-mcp ./charts/dev-io-mcp \
  --namespace dev-io \
  --create-namespace \
  --set image.repository=ghcr.io/example/dev-io-mcp \
  --set image.tag=0.1.0
```

For digest pinning:

```bash
--set image.repository=ghcr.io/example/dev-io-mcp \
--set image.digest=sha256:REPLACE_WITH_DIGEST
```

## Remote metrics API

The chart does not put credentials in Git. Use an existing Secret:

```bash
helm upgrade --install dev-io-mcp ./charts/dev-io-mcp \
  --namespace dev-io \
  --set remote.enabled=true \
  --set remote.apiBaseUrl=https://your-dev-io-domain.example \
  --set remote.existingSecret=dev-io-api \
  --set remote.existingSecretKey=api-token
```

For a development-only Secret created by Helm, use `remote.createSecret=true` and pass `remote.apiToken` through a private values file. Do not put that value in a committed values file or shell history in shared environments.

## Publish to DEV.to

Enable the official DEV.to/Forem publisher with an existing Secret:

```bash
helm upgrade --install dev-io-mcp ./charts/dev-io-mcp \
  --namespace dev-io \
  --set devTo.publish=true \
  --set devTo.apiBaseUrl=https://dev.to \
  --set devTo.existingSecret=dev-to-api \
  --set devTo.existingSecretKey=api-key
```

The Secret must contain a DEV.to API key. `publish_post` will create the local Markdown file, then call `POST /api/articles` from the [Forem API](https://developers.forem.com/api/v0). The returned article ID and URL are stored in `data/remote-posts.json`.

The same DEV.to base URL is used by `list_post_comments` for the documented public comments endpoint. Comment creation and replies remain local because Forem does not provide API-key write endpoints for comments.

For development only, `devTo.createSecret=true` can create a Secret from a private values file. Never commit `devTo.apiKey`.

## Optional features

Examples:

```bash
# Ingress
--set ingress.enabled=true --set ingress.className=traefik
--set ingress.hosts[0].host=dev-io-mcp.dev.local
--set ingress.tls[0].secretName=local-dev-tls

# HPA
--set autoscaling.enabled=true --set autoscaling.minReplicas=2 --set autoscaling.maxReplicas=5

# PDB
--set podDisruptionBudget.enabled=true --set podDisruptionBudget.minAvailable=1

# NetworkPolicy: provide explicit ingress/egress rules in a values file.
```

Review and customize `values.yaml` for storage class, access modes, resources, scheduling, security context, and network policy rules.

## Inspect and uninstall

```bash
helm lint ./charts/dev-io-mcp
helm template dev-io-mcp ./charts/dev-io-mcp --namespace dev-io
helm get manifest dev-io-mcp -n dev-io
helm uninstall dev-io-mcp -n dev-io
```
