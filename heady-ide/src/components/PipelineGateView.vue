<template>
  <div class="gate-container">
    <div v-for="(gate, index) in gates" :key="index" 
         :class="['gate', gate.passed ? 'passed' : 'failed']">
      {{ gate.name }}: {{ gate.passed ? '✓' : '✗' }}
    </div>
  </div>
</template>

<script>
export default {
  props: {
    gates: Array
  }
};
</script>

<style scoped>
.gate-container { display: flex; }
.gate { padding: 5px; margin: 2px; }
.passed { background: green; }
.failed { background: red; }
</style>
