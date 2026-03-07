# Observability

## Minimum telemetry

- request id
- trace id
- route
- model or tool target
- latency
- error class
- retry count
- safety decision
- projection version

## Health surfaces

Every service should expose:

- /health
- /ready
- /metrics

## Operational dashboards

- ingress health
- orchestration success rate
- tool routing failures
- memory retrieval latency
- projection freshness
- release drift between monorepo and projected repos
