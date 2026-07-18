# Kubernetes mode

The Kubernetes mode runs the MCP server over Streamable HTTP. It uses a `Deployment`, a ClusterIP `Service`, health probes, and persistent volumes for posts and metrics.

## Local cluster

Build the image in the same container runtime used by the cluster, then render or apply the local overlay:

```bash
npm run docker:build
npm run k8s:render
npm run k8s:apply
```

Check the rollout:

```bash
kubectl -n dev-io rollout status deployment/dev-io-mcp
kubectl -n dev-io get pods,svc,pvc
```

Expose it locally:

```bash
kubectl -n dev-io port-forward svc/dev-io-mcp 3000:3000
```

The MCP endpoint is then:

```text
http://127.0.0.1:3000/mcp
```

## Remote cluster

Push the image to a registry, replace the image in an overlay, and apply the rendered manifests. Do not put `DEV_IO_API_TOKEN` in Git. Inject it through your cluster's Secret manager and add an environment reference to the Deployment.

The default PVCs are intentionally generic. Set a `storageClassName` in a cluster-specific overlay when the cluster does not provide a default storage class.

## Helm

For configurable deployments, use the full Helm chart instead of editing the raw manifests:

```bash
helm lint ./charts/dev-io-mcp
helm upgrade --install dev-io-mcp ./charts/dev-io-mcp \
  --namespace dev-io \
  --create-namespace \
  --set image.repository=dev-io-mcp \
  --set image.tag=local
```

See [`../../charts/dev-io-mcp/README.md`](../../charts/dev-io-mcp/README.md) for values, Secrets, Ingress, autoscaling, and storage configuration.
