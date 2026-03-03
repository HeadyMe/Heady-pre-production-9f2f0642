# Random Optimizer Node + Adaptive Idle-Learning System

> **Source:** Gemini conversation export (Eric Haywood)
> **Date:** Pre-2026 research
> **Status:** Reference / Design spec for Heady optimization engine
> **Relevance:** Core pattern for weighted random task selection + idle-time learning

---

## Core Concept: Random Optimizer Node

A **stochastic priority queue** — combines randomness with priority ranking using weighted probability (Roulette Wheel Selection).

### Algorithm

1. **Sum weights:** Total of all priority scores
2. **Generate random number:** Between 0 and total sum
3. **Iterate & subtract:** Walk through list, subtracting each task's priority
4. **Selection:** Task that drops the number below zero wins

### Key Properties

- Standard Random: Equal chance (1/Total)
- Priority Random: Higher priority = larger "slice" of the probability pie
- Task A (Priority 10) vs Task B (Priority 1) → Task A is 10× more likely

---

## Adaptive Optimizer: Idle Power-Up

A **Dynamic Feedback Loop** — expands capabilities when system is quiet, contracts under load.

### Inverse Scaling Logic

| System State | Budget | Task Types | Sleep Time |
| --- | --- | --- | --- |
| High Load (User active) | Low (10% CPU) | Critical, lightweight fixes only | Long intervals |
| Normal | Medium | Standard optimization tasks | Normal intervals |
| Idle (User away) | High (90% CPU) | Deep learning, retraining, heavy work | Short intervals (aggressive) |

### Throttle Down (Busy)

```python
if is_busy:
    if cost > 3:
        priority = 0  # Remove heavy tasks completely
```

Heavy tasks get Priority 0 — removed from the roulette wheel entirely.

### Power Up (Idle)

```python
elif is_idle:
    if cost > 5:
        priority = priority * 3  # Triple probability of learning tasks
```

Learning tasks become **dominant** during idle — aggressive utilization of free compute.

---

## Priority Decay Mechanism

Prevents "getting stuck" on the same high-priority task:

1. Node picks Task A (Priority 10) → executes it
2. Task A's priority temporarily drops to 1
3. Next run: Task B (Priority 5) gets its chance
4. After X turns: Task A slowly regenerates back to 10

**Result:** System covers all improvements eventually while still favoring the best strategies.

---

## Implementation Classes

### RandomOptimizerNode

```python
class RandomOptimizerNode:
    def __init__(self):
        self.task_pool = {}  # {'task_name': priority_score}

    def add_improvement(self, task_name, priority):
        self.task_pool[task_name] = priority

    def get_task(self):
        tasks = list(self.task_pool.keys())
        weights = list(self.task_pool.values())
        return random.choices(tasks, weights=weights, k=1)[0]
```

### AdaptiveOptimizer

- Monitors CPU via `psutil.cpu_percent()`
- Idle threshold: < 20% CPU
- Busy threshold: > 50% CPU
- Dynamic sleep: 1s when idle, 5s when busy
- GPU detection via `torch.cuda` or `pynvml`

---

## Hardware Acceleration Note

- CPU monitoring alone is insufficient for neural network tasks
- Must also monitor **GPU VRAM** usage
- If GPU is free → trigger CUDA-enabled optimization
- If VRAM is high (user gaming) → stick to CPU-only tasks or idle completely
