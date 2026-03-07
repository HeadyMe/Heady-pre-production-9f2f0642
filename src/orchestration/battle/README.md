# HeadyBattle Perplexity-Style Orchestration with Phi-Based Temperature Scaling

**Generated:** March 7, 2026 12:58 PM MST  
**Purpose:** Multi-model parallel orchestration with dynamic semantic temperature control

## 🎯 Core Innovation: Dynamic Semantic Logic Gates

This bundle implements Perplexity Computer's multi-model orchestration pattern, enhanced with **phi-based dynamic temperature scaling** that flows with semantic context.

### Key Architectural Patterns

1. **Model Council** - Parallel multi-model execution (like Perplexity's 19-model system)
2. **Semantic Logic Gates** - Task analysis determines optimal temperature via logic gates
3. **Phi Temperature Scaling** - All temperature values derived from golden ratio (φ = 1.618...)
4. **Context Optimization** - Intelligent context compression with relevance scoring
5. **Quality Gates** - Automated validation during coding workflows
6. **Dynamic Orchestration** - Task decomposition → parallel execution → synthesis

## 📐 Phi-Based Temperature Philosophy

Traditional AI systems use static temperature maps:
```typescript
// ❌ OLD WAY: Static temperature
const temperatures = {
  'coding': 0.2,
  'research': 0.7,
  'creative': 0.9
};
```

HeadyBattle uses **dynamic phi-scaled temperatures** that flow with semantic context:
```typescript
// ✅ NEW WAY: Phi-scaled dynamic temperature
const PHI_TEMPERATURE_SCALES = {
  DETERMINISTIC: φ^-4 = 0.146,    // Ultra-precise
  PRECISION: φ^-3 = 0.236,        // High precision
  BALANCED: φ^-2 = 0.382,         // Creative-precision balance
  CREATIVE: φ^-1 = 0.618,         // Creative exploration
  EXPLORATORY: φ^0 = 1.0,         // Maximum creativity
  FRACTAL: φ^1 = 1.618            // Extreme creativity
};
```

## 🔄 Semantic Logic Gates

The system analyzes task semantics to select the appropriate temperature gate:

| Gate | Keywords | Base Temp | Use Case |
|------|----------|-----------|----------|
| **PRECISION** | exact, precise, calculate | 0.236 | Deterministic computation |
| **VALIDATION** | validate, check, verify | 0.146 | Code review & testing |
| **OPTIMIZATION** | optimize, improve, refine | 0.382 | Performance enhancement |
| **CREATIVITY** | creative, novel, innovative | 0.618 | Brainstorming & design |
| **EXPLORATION** | explore, discover, search | 1.0 | Research & discovery |
| **ANALYSIS** | analyze, understand, reason | 0.382 | Deep reasoning |
| **SYNTHESIS** | combine, merge, integrate | 0.618 | Multi-source integration |
| **TRANSFORMATION** | convert, transform, migrate | 0.382 | Code migration |

## 🌊 Dynamic Temperature Flow

Temperature is not static—it flows based on:

### 1. **Complexity Modifier** (φ^-n scaling)
Higher complexity → lower temperature for precision
```typescript
temp *= Math.pow(PHI, -context.complexity);
```

### 2. **Uncertainty Modifier** (φ^n scaling)
Higher uncertainty → higher temperature for exploration
```typescript
temp *= Math.pow(PHI, context.uncertainty * 0.5);
```

### 3. **Prior Attempts Modifier**
Each failure increases exploration (learns from mistakes)
```typescript
temp *= (1 + (attempts * 0.382)); // 0.382 = φ^-2
```

### 4. **Domain Knowledge Modifier**
More knowledge → lower temp (precise execution)
```typescript
temp *= (PHI_INVERSE + (knowledge * PHI_INVERSE));
```

### 5. **Trajectory Smoothing**
Prevents jarring temperature jumps using phi-weighted moving average
```typescript
smoothed = (recentAvg * φ^-1) + (targetTemp * φ^-2);
```

## 🏗️ Architecture Components

### 1. Orchestrator (`core/orchestrator/index.ts`)
- Task decomposition (break complex tasks into sub-tasks)
- Sub-agent spawning (parallel execution)
- Model selection (route to optimal model per sub-task)
- Result synthesis (combine multi-model outputs)
- Quality gate validation (auto-retry on failures)

### 2. Model Council (`core/model-council/index.ts`)
- Parallel multi-model queries
- Agreement/disagreement analysis
- Confidence scoring
- Provider routing (Anthropic, OpenAI, Google, Perplexity)

### 3. Dynamic Temperature Controller (`core/semantic-temperature/index.ts`)
- **Semantic gate selection** via keyword analysis
- **Phi-scaled temperature calculation** with modifiers
- **Trajectory smoothing** for stable temperature flow
- **Phase-aware** temperature bounds (planning vs validation)

### 4. Context Optimizer (`core/context-optimizer/index.ts`)
- Semantic context building from tasks
- Relevance scoring & pruning
- Context compression
- **Automatic temperature calculation** via semantic gates

### 5. Quality Gate Validator (`quality-gates/index.ts`)
- Security scanning (hardcoded secrets, SQL injection, XSS)
- Complexity analysis (cyclomatic complexity, function length)
- Architecture checks (error handling, console logs)
- Performance validation (sync I/O detection)

## 🚀 Usage Example

```typescript
import HeadyBattleOrchestrator from './core/orchestrator';
import { SEMANTIC_PRESETS } from './core/semantic-temperature';

// Initialize orchestrator
const orchestrator = new HeadyBattleOrchestrator({
  models: ['claude-opus-4-6', 'gpt-5-4-turbo', 'gemini-3-1-pro'],
  contextStrategy: 'balanced',
  qualityRules: QualityGateValidator.defaultRules()
});

// Execute task with automatic temperature optimization
const result = await orchestrator.executeTask({
  id: 'task-001',
  type: 'coding',
  description: 'Implement user authentication with OAuth2',
  context: {
    relevant_code: ['src/auth/*.ts'],
    documentation: ['docs/oauth.md'],
    prior_attempts: [],
    user_preferences: { framework: 'Next.js' }
  },
  priority: 1,
  dependencies: []
});

// Temperature was dynamically calculated:
// - Gate: PRECISION (code implementation)
// - Base temp: 0.236 (φ^-3)
// - Modifiers: complexity, uncertainty, domain knowledge
// - Final temp: ~0.18 (deterministic code generation)

console.log(result.synthesis);
console.log(`Confidence: ${result.confidence}`);
console.log(`Models used: ${result.models_used.join(', ')}`);
```

## 📊 Temperature Flow Example

Given a coding task that fails twice, temperature evolves:

```
Attempt 1: Gate=PRECISION, Temp=0.236 → FAILED
Attempt 2: Gate=PRECISION, Temp=0.618 (increased due to prior failure) → FAILED  
Attempt 3: Gate=EXPLORATION, Temp=1.0 (switched gate, max exploration) → SUCCESS
```

The system **learns from failures** by increasing temperature and switching gates.

## 🔬 Phi-Scaling Mathematics

### Golden Ratio Powers
```
φ^-4 = 0.146   (deterministic)
φ^-3 = 0.236   (precision)
φ^-2 = 0.382   (balanced)
φ^-1 = 0.618   (creative)
φ^0  = 1.000   (exploratory)
φ^1  = 1.618   (fractal)
```

### Trajectory Smoothing
```
smoothed = (recent_avg × 0.618) + (target × 0.382)
```

### Confidence Calculation
```
confidence = agreements / (agreements + disagreements)
```

## 🎭 Integration with HeadyBattle

This orchestration system integrates into HeadyBattle's coding workflow:

1. **Task received** → Build semantic context
2. **Calculate temperature** → Semantic gates + phi modifiers
3. **Spawn sub-agents** → Parallel execution across models
4. **Execute Model Council** → Claude + GPT + Gemini in parallel
5. **Synthesize results** → Agreement/disagreement analysis
6. **Quality gates** → Security, complexity, architecture checks
7. **Auto-retry on failure** → Increase temperature, try again
8. **Learn from errors** → Phi-scaled resilience scoring

## 📁 File Structure

```
HeadyBattle_Perplexity_Orchestration/
├── core/
│   ├── orchestrator/
│   │   └── index.ts              # Main orchestration engine
│   ├── model-council/
│   │   └── index.ts              # Multi-model parallel execution
│   ├── semantic-temperature/
│   │   └── index.ts              # Phi-based dynamic temperature
│   └── context-optimizer/
│       └── index.ts              # Context optimization + temp integration
├── quality-gates/
│   └── index.ts                  # Coding workflow validation
├── workflows/
│   └── coding-workflow.ts        # End-to-end coding pipeline
├── config/
│   └── models.json               # Model configurations
└── README.md                     # This file
```

## 🔑 Key Benefits

1. **Adaptive Temperature** - Flows with task semantics, not hardcoded
2. **Phi Harmony** - All scaling follows golden ratio for natural feel
3. **Multi-Model Validation** - Agreement/disagreement gives confidence signals
4. **Quality Assurance** - Automated gates catch bugs before deployment
5. **Learning from Failure** - Errors increase exploration temperature
6. **Semantic Awareness** - Logic gates understand task intent
7. **Fractal Scaling** - Same patterns repeat at all levels (φ property)

## 🧪 Testing Temperature Flow

```typescript
import DynamicTemperatureController from './core/semantic-temperature';

const controller = new DynamicTemperatureController();

// Test precision task
const flow1 = controller.calculateTemperature({
  taskType: 'code-generation',
  keywords: ['implement', 'calculate', 'precise'],
  complexity: 0.3,
  uncertainty: 0.1,
  priorAttempts: 0,
  codegenPhase: 'implementation',
  domainKnowledge: 0.8
});

console.log(flow1);
// Output: Gate=PRECISION, Temp=0.189, PhiScale=0.25

// Test creative task
const flow2 = controller.calculateTemperature({
  taskType: 'design',
  keywords: ['creative', 'innovative', 'explore'],
  complexity: 0.7,
  uncertainty: 0.8,
  priorAttempts: 0,
  codegenPhase: 'planning',
  domainKnowledge: 0.3
});

console.log(flow2);
// Output: Gate=CREATIVITY, Temp=0.847, PhiScale=0.78
```

## 📚 References

- Perplexity Model Council: https://www.perplexity.ai/hub/blog/introducing-model-council
- Golden Ratio in Computing: phi-math-foundation package
- Semantic Logic Gates: HeadyBattle architecture
- Multi-Agent Orchestration: MAO-ARAG, MARCO papers

---

**Built for HeadyBattle by HeadySystems Inc.**  
**Integrates into: Heady-pre-production monorepo**
