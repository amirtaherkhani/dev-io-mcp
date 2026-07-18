# dev-io-mcp Helm chart

This chart deploys the MCP server in HTTP mode. It is the Kubernetes packaging for the server; standalone Claude/Codex stdio mode remains available through `npm start`.

## Local image

Build the image in the container runtime used by the cluster:

```bash
npm run docker:build
helm upgrade --install dev-io-mcp ./charts/dev-io-mcp \
  --namespace dev-io \
  --create-namespace \
  --set image.repository=dev-io-mcp \
  --set image.tag=local
```

For Rancher Desktop or another local cluster, confirm that the cluster can see the local `dev-io-mcp:local` image. If it cannot, push the image to a registry and set `image.repository` and `image.tag` to that image instead.

## Connect locally

```bash
kubectl -n dev-io rollout status deployment/dev-io-mcp
kubectl -n dev-io port-forward svc/dev-io-mcp 3000:3000
```

MCP endpoint: `http://127.0.0.1:3000/mcp`

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

## Optional features

Examples:

```bash
# Ingress
--set ingress.enabled=true --set ingress.className=nginx

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
