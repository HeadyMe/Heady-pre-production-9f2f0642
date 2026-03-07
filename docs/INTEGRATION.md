# Integration with Heady Architecture

## HeadyBrain Decision-Making

Replace:
```typescript
if (confidence > 0.8 && load < 50) {
  deploy();
} else {
  queue();
}
```

With:
```typescript
const decision = brainAdapter.decide({
  inputs: new Map([['confidence', 0.85], ['load', 45]]),
  constraints: [/* semantic constraints */],
  preferences: [/* semantic preferences */]
});

if (decision.decision === 'PROCEED') {
  deploy();
}
```

## HeadyConductor Health Monitoring

Replace:
```typescript
if (cpuUsage > 80 && errorRate > 0.1) {
  scaleUp();
}
```

With:
```typescript
const health = conductorAdapter.evaluateHealth(metrics);
if (health.urgency.value > 0.75) {
  health.action(); // 'SCALE_UP' | 'REBALANCE' | 'ALERT'
}
```

## Auto-Success Engine

Transform 135 background task health checks from binary to continuous.

## Arena Mode

Use continuous scores instead of binary win/loss for solution evaluation.
