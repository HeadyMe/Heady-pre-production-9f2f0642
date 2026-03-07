import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const packageNames = [
  'phi-math',
  'csl-router',
  'spatial-events',
  'agent-identity',
  'memory-stream',
  'observability-kernel',
  'latent-boundary',
  'kernel',
];

for (const name of packageNames) {
  const dist = join(process.cwd(), 'packages', name, 'dist');
  if (existsSync(dist)) {
    rmSync(dist, { recursive: true, force: true });
  }
}
