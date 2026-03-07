# ADR 0005: Use Cloud Run as Primary Deployment Target Over Self-Managed Kubernetes

**Status:** Accepted  
**Date:** 2026-03-07  
**Authors:** Eric Headington, Platform Engineering  
**φ-revision:** 1.618  

---

## Context

HeadySystems requires a container orchestration platform for 21 microservices. The primary candidates evaluated were:
1. **Google Cloud Run** — fully managed serverless containers
2. **Google Kubernetes Engine (GKE)** — managed Kubernetes
3. **Self-managed Kubernetes** — Kubernetes on GCE VMs
4. **AWS ECS / EKS** — AWS equivalents

The platform needs:
- Auto-scaling from 0 to high load (traffic is variable)
- Low operational overhead (founding team, no dedicated DevOps)
- Multi-region support (us-central1, europe-west1, asia-east1)
- Private networking for inter-service communication
- Support for enterprise customers who may require Kubernetes

---

## Decision

**Use Google Cloud Run as the primary deployment target for all HeadySystems services.**

Kubernetes manifests (`k8s/`) are maintained as a secondary deployment path for enterprise customers who require self-managed infrastructure.

---

## Rationale

### Cost Economics

At the founder/pilot stage, Cloud Run's billing model is significantly cheaper:

| Scenario | Cloud Run | GKE Autopilot | GKE Standard |
|----------|-----------|---------------|--------------|
| Idle (0 traffic) | $0 | ~$75/mo (cluster) | ~$200/mo |
| Low traffic (10 RPS) | ~$30/mo | ~$120/mo | ~$220/mo |
| Pilot (100 RPS) | ~$150/mo | ~$280/mo | ~$400/mo |
| Scale (1000 RPS) | ~$800/mo | ~$900/mo | ~$1200/mo |

*Estimates based on 2-vCPU, 2GB services, us-central1 pricing.*

Cloud Run's scale-to-zero eliminates idle costs during development and between pilot sessions.

### Operational Complexity

Cloud Run eliminates the operational burden of:

| Concern | Cloud Run | Kubernetes |
|---------|-----------|-----------|
| Control plane | Google-managed | Self-managed or GKE fee |
| Node pool management | Automatic | Manual or Autopilot |
| OS/kernel patching | Automatic | Customer responsibility |
| Network policies | VPC connectors | Pod network policies |
| Ingress | Cloud Load Balancing | Ingress controllers |
| TLS certificates | Automatic | cert-manager |
| Service mesh | Built-in | Istio/Linkerd install |
| Autoscaling | HPA + KEDA via requests | Manual HPA configuration |

For a founder-stage team, this represents months of saved infrastructure work.

### Scaling Characteristics

Cloud Run auto-scales based on request concurrency with φ-aligned parameters:

```yaml
# Cloud Run service manifest
concurrency: 89     # fib(11) — concurrent requests per instance
minInstances: 2     # fib(3)  — always warm
maxInstances: 21    # fib(8)  — maximum horizontal scale
timeout: 55s        # fib(10) — request timeout
```

Scale-up latency (cold start) averages 800ms–2s for the Node.js 20 runtime, which is acceptable for API workloads. WebSocket connections use sticky routing via session headers.

### Multi-Region Simplicity

Cloud Run services deploy to multiple regions with a single `gcloud run deploy` command per region. DNS-based failover (Cloudflare load balancing) routes traffic. Cross-region traffic is handled via the CDN layer, not the service mesh.

This is significantly simpler than multi-region Kubernetes with federation or GitOps cluster management.

### GCP Integration

Cloud Run integrates natively with:
- Cloud SQL (private VPC connector)
- Secret Manager (GOOGLE_APPLICATION_CREDENTIALS auto-mounted)
- Cloud Logging / Cloud Trace (automatic instrumentation)
- Cloud Build (CI/CD pipeline)
- Cloud Armor (WAF / DDoS)

The `cloudbuild.yaml` at the monorepo root drives CI/CD without additional orchestration.

### Traffic Splitting

Cloud Run's built-in traffic splitting is used for blue-green and canary deployments:
```bash
gcloud run services update-traffic heady-brain \
  --to-revisions=revision-v2=5,revision-v1=95
```

The `blue-green-deploy.sh` and `canary-deploy.sh` scripts implement the φ-scaled rollout.

---

## Limitations and Mitigations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No persistent storage | Stateful services can't use local disk | Redis (state), GCS (files), Cloud SQL (data) |
| Cold start latency | P99 latency spikes after idle | `minInstances: 2` keeps warm replicas |
| Max request timeout | 60 min hard limit | Long tasks use async queues |
| No DaemonSets | Can't run node-level agents | Cloud Monitoring handles observability |
| WebSocket limitations | Sticky sessions required | Redis session store + load balancer affinity |
| Port restriction | Only port 8080 | Standard for all services |

---

## Kubernetes Support (Enterprise Path)

For enterprise customers with existing Kubernetes clusters or compliance requirements:

### Provided Manifests

The `k8s/` directory contains:
- `k8s/deployments/` — Deployment per service
- `k8s/services/` — Service + Ingress definitions
- `k8s/hpa/` — HPA policies (same φ-scaling as Cloud Run)
- `k8s/configmaps/` — Configuration
- `k8s/secrets/` — ExternalSecrets (Vault / AWS Secrets Manager)

### Helm Chart

A Helm chart (`helm/heady-systems/`) is available with:
- Configurable replica counts (default: Fibonacci minimums)
- Resource limits (CPU/memory at φ-derived values)
- Pod disruption budgets (minAvailable: fib(4)=3)
- Network policies (zero-trust inter-pod communication)

### GKE Autopilot Recommendation

For enterprises preferring GKE, GKE Autopilot is recommended over standard GKE:
- Reduced node management
- Pay-per-pod billing
- Faster to production than standard GKE
- Directly uses the k8s/ manifests

---

## Decision Review Triggers

This decision should be revisited if:
1. Cloud Run per-request costs exceed $2,000/month (indicator: higher volume makes GKE more economical)
2. A service requires DaemonSet-style infrastructure (e.g., GPU-backed inference)
3. Enterprise customer requirements make Kubernetes mandatory for >50% of deployment targets
4. Multi-tenancy isolation requirements cannot be met with VPC-level separation

---

## Consequences

### Positive
- Zero Kubernetes cluster management overhead
- Scale-to-zero saves $200–500/month in early stages
- Built-in TLS, load balancing, autoscaling
- Faster iteration: `gcloud run deploy` in <2 minutes

### Negative
- Vendor lock-in: Cloud Run manifests differ from Kubernetes
- Limited control over runtime environment
- Cold start latency for infrequently used services
- Enterprise customization requires Kubernetes manifest maintenance in parallel

---

## References

- Google Cloud Run documentation: https://cloud.google.com/run/docs
- `cloudbuild.yaml` — Cloud Build CI/CD pipeline
- `scalability/deployment/blue-green-deploy.sh`
- `scalability/deployment/canary-deploy.sh`
- `scalability/multi-region/active-active-config.yaml`
