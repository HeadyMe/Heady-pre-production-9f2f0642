# Usage Examples

## Basic Gate Usage

```typescript
import { AND, OR, NOT, truthValue } from '@headysystems/semantic-logic';

const a = truthValue(0.7, 'condition_a');
const b = truthValue(0.5, 'condition_b');

const result = AND([a, b], { tnorm: 'product' });
console.log(result.value); // 0.35

if (result.isTruthy(0.4)) {
  // Execute action
}
```

## Membership Functions

```typescript
import { sigmoid, SemanticVariable } from '@headysystems/semantic-logic';

const cpuVar = new SemanticVariable('cpu', [0, 100])
  .addTerm('low', triangular(0, 0, 40))
  .addTerm('high', sigmoid(70, 0.1));

const fuzzified = cpuVar.fuzzify(75);
console.log(fuzzified.get('high')?.value); // ~0.93
```

## Full Transformation

```bash
heady-semantic transform "src/**/*.ts" \
  --output-dir ./transformed \
  --default-tnorm product \
  --min-complexity 2 \
  --generate-report
```
