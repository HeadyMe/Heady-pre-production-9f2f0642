/**
 * @fileoverview Complete Heady Integration Example
 * @description Shows VSA integration with Heady orchestration system
 */

const { VSACodebook } = require('../src/vsa/codebook');
const { VSASemanticGates } = require('../src/vsa/vsa-csl-bridge');
const { Hypervector } = require('../src/vsa/hypervector');

console.log('=== Heady VSA Full Integration Example ===\n');

// 1. Initialize Heady Codebook
console.log('1. Initializing Heady Semantic Codebook...');
const codebook = VSACodebook.createHeadyCodebook(4096);

// Add domain-specific concepts
const additionalConcepts = [
  'TASK', 'HIGH_PRIORITY', 'LOW_PRIORITY',
  'EXECUTE', 'QUEUE', 'REJECT',
  'DATABASE', 'API', 'COMPUTE',
  'SUCCESS', 'FAILURE', 'PENDING'
];

for (const concept of additionalConcepts) {
  codebook.add(concept, null, { type: 'atomic', domain: 'orchestration' });
}

console.log(`   Codebook now has ${codebook.concepts.size} concepts\n`);

// 2. Create Semantic Gates
console.log('2. Creating VSA Semantic Gates...');
const gates = new VSASemanticGates(codebook);
console.log('   ✅ Gates ready\n');

// 3. Simulate Task Orchestration
console.log('3. Task Orchestration Simulation\n');

class Task {
  constructor(id, type, priority, confidence, load) {
    this.id = id;
    this.type = type;
    this.priority = priority;
    this.confidence = confidence;
    this.load = load;
  }

  toHypervector(codebook, gates) {
    // Convert task properties to semantic concepts
    const concepts = ['TASK'];

    if (this.type === 'database') concepts.push('DATABASE');
    else if (this.type === 'api') concepts.push('API');
    else if (this.type === 'compute') concepts.push('COMPUTE');

    if (this.priority > 0.7) concepts.push('HIGH_PRIORITY');
    else concepts.push('LOW_PRIORITY');

    // Bundle into task vector
    return gates.superposition_gate(...concepts);
  }
}

// Create test tasks
const tasks = [
  new Task('T1', 'database', 0.9, 0.85, 0.3),
  new Task('T2', 'api', 0.5, 0.6, 0.8),
  new Task('T3', 'compute', 0.8, 0.9, 0.2)
];

console.log('   Created tasks:');
for (const task of tasks) {
  console.log(`   - ${task.id}: ${task.type}, priority=${task.priority}, confidence=${task.confidence}, load=${task.load}`);
}
console.log();

// 4. Orchestration Decision (NO if/else!)
console.log('4. Making orchestration decisions (continuous logic)...\n');

for (const task of tasks) {
  console.log(`   Task ${task.id}:`);

  // Convert to hypervector
  const taskVec = task.toHypervector(codebook, gates);

  // Continuous decision gates
  const confGate = gates.soft_gate(task.confidence, 0.8, 10);
  const prioGate = gates.soft_gate(task.priority, 0.7, 10);
  const loadGate = gates.soft_gate(1 - task.load, 0.5, 10);

  // Decision scores (all computed simultaneously)
  const executeNow = gates.continuous_and(confGate, gates.continuous_and(prioGate, loadGate));
  const executeLater = gates.continuous_and(confGate, gates.continuous_and(prioGate, gates.continuous_not(loadGate)));
  const queueScore = gates.continuous_and(confGate, gates.continuous_not(prioGate));
  const rejectScore = gates.continuous_not(confGate);

  console.log(`      Confidence gate: ${confGate.toFixed(4)}`);
  console.log(`      Priority gate: ${prioGate.toFixed(4)}`);
  console.log(`      Load gate: ${loadGate.toFixed(4)}`);
  console.log(`      Decision scores:`);
  console.log(`        - Execute now: ${executeNow.toFixed(4)}`);
  console.log(`        - Execute later: ${executeLater.toFixed(4)}`);
  console.log(`        - Queue: ${queueScore.toFixed(4)}`);
  console.log(`        - Reject: ${rejectScore.toFixed(4)}`);

  // Select highest score
  const decisions = {
    'EXECUTE_NOW': executeNow,
    'EXECUTE_LATER': executeLater,
    'QUEUE': queueScore,
    'REJECT': rejectScore
  };

  const bestDecision = Object.entries(decisions).reduce((best, curr) => 
    curr[1] > best[1] ? curr : best
  );

  console.log(`      → Decision: ${bestDecision[0]} (score: ${bestDecision[1].toFixed(4)})\n`);
}

// 5. Agent Matching via Resonance
console.log('5. Agent matching via semantic resonance...\n');

// Define agent specializations
const agents = [
  { name: 'DatabaseAgent', concepts: ['DATABASE', 'HEADY', 'AGENT'] },
  { name: 'APIAgent', concepts: ['API', 'HEADY', 'AGENT'] },
  { name: 'ComputeAgent', concepts: ['COMPUTE', 'HEADY', 'AGENT'] }
];

// Create agent hypervectors
for (const agent of agents) {
  const agentVec = gates.superposition_gate(...agent.concepts);
  codebook.add(agent.name, agentVec, { type: 'agent', domain: 'heady_agents' });
}

// Match tasks to agents
for (const task of tasks) {
  const taskVec = task.toHypervector(codebook, gates);

  console.log(`   Task ${task.id} (${task.type}):`);

  // Query for best agent match
  const matches = gates.query_gate(taskVec, 0.3, 3);

  for (const match of matches) {
    if (match.metadata && match.metadata.type === 'agent') {
      console.log(`      - ${match.name}: ${match.similarity.toFixed(4)}`);
    }
  }
  console.log();
}

// 6. State Tracking with Phi-Scales
console.log('6. State tracking with phi-scale values...\n');

const systemState = gates.superposition_gate('HEADY', 'ORCHESTRATOR', 'SEMANTIC');
const phiValue = systemState.toPhiScale();
const truthValue = systemState.toTruthValue();

console.log(`   System state hypervector:`);
console.log(`   - Phi-scale value: ${phiValue.toFixed(4)} (range: [0, ${((1 + Math.sqrt(5)) / 2).toFixed(4)}])`);
console.log(`   - Truth value: ${truthValue.toFixed(4)} (range: [0, 1])`);
console.log(`   - Dimensionality: ${systemState.dimensionality}\n`);

// 7. Performance Stats
console.log('7. Performance statistics...\n');
console.log(codebook.stats());

console.log('\n=== Integration Example Complete ===');
console.log('\n✨ Key Takeaways:');
console.log('   • No if/else statements used in decision logic');
console.log('   • All decisions computed continuously');
console.log('   • Semantic matching via hypervector resonance');
console.log('   • Phi-scale integration for continuous values');
console.log('   • Instant pattern recognition via codebook queries');
