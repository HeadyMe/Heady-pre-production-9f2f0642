/**
 * @fileoverview Basic VSA Usage Example
 * @description Demonstrates core VSA operations
 */

const { Hypervector } = require('../src/vsa/hypervector');
const { VSACodebook } = require('../src/vsa/codebook');

console.log('=== Heady VSA Basic Example ===\n');

// 1. Create random hypervectors
console.log('1. Creating hypervectors...');
const catVector = Hypervector.random(4096);
const dogVector = Hypervector.random(4096);
const birdVector = Hypervector.random(4096);

console.log(`   Cat vector: ${catVector.toString()}`);
console.log(`   Dog vector: ${dogVector.toString()}`);
console.log(`   Bird vector: ${birdVector.toString()}\n`);

// 2. Measure similarity (random vectors should be ~0)
console.log('2. Measuring similarity...');
console.log(`   Cat <-> Dog: ${catVector.similarity(dogVector).toFixed(4)}`);
console.log(`   Cat <-> Bird: ${catVector.similarity(birdVector).toFixed(4)}`);
console.log(`   Dog <-> Bird: ${dogVector.similarity(birdVector).toFixed(4)}\n`);

// 3. Binding operation (compositional)
console.log('3. Binding CAT with DOG...');
const catDog = catVector.bind(dogVector);
console.log(`   CAT ⊗ DOG similarity to CAT: ${catDog.similarity(catVector).toFixed(4)}`);
console.log(`   CAT ⊗ DOG similarity to DOG: ${catDog.similarity(dogVector).toFixed(4)}`);
console.log(`   CAT ⊗ DOG is orthogonal to both\n`);

// 4. Bundling operation (superposition)
console.log('4. Bundling animals...');
const animals = catVector.bundle([dogVector, birdVector]);
console.log(`   ANIMALS similarity to CAT: ${animals.similarity(catVector).toFixed(4)}`);
console.log(`   ANIMALS similarity to DOG: ${animals.similarity(dogVector).toFixed(4)}`);
console.log(`   ANIMALS similarity to BIRD: ${animals.similarity(birdVector).toFixed(4)}`);
console.log(`   ANIMALS is similar to all constituents\n`);

// 5. Using a codebook
console.log('5. Creating codebook...');
const codebook = new VSACodebook(4096);

// Add concepts
codebook.add('CAT', catVector);
codebook.add('DOG', dogVector);
codebook.add('BIRD', birdVector);
codebook.add('FISH', Hypervector.random(4096));

// Create composite
codebook.bundle('ANIMALS', ['CAT', 'DOG', 'BIRD']);

console.log(`   Codebook contains: ${codebook.listConcepts().join(', ')}\n`);

// 6. Query the codebook
console.log('6. Querying codebook...');
const query = animals; // Query with the bundled ANIMALS vector
const results = codebook.query(query, 0.3, 3);

console.log(`   Top matches for ANIMALS query:`);
for (const result of results) {
  console.log(`   - ${result.name}: ${result.similarity.toFixed(4)}`);
}

// 7. Phi-scale integration
console.log('\n7. Phi-scale values...');
console.log(`   CAT phi-value: ${catVector.toPhiScale().toFixed(4)}`);
console.log(`   DOG phi-value: ${dogVector.toPhiScale().toFixed(4)}`);
console.log(`   ANIMALS phi-value: ${animals.toPhiScale().toFixed(4)}`);

// 8. Truth values for CSL gates
console.log('\n8. Truth values for CSL...');
console.log(`   CAT truth-value: ${catVector.toTruthValue().toFixed(4)}`);
console.log(`   ANIMALS truth-value: ${animals.toTruthValue().toFixed(4)}`);

console.log('\n=== Example Complete ===');
