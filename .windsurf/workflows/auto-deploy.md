---
description: Auto-deploy workflow with AI service selection
---

1. **Pre-deployment Checks**
   - Verify all services are healthy
   - Check resource availability
   - Validate configuration

2. **Service Selection**
   - Use Monte Carlo to select optimal deployment strategy
   - Auto-mode considers:
     * Historical performance
     * Current load
     * Cost factors
     * Reliability metrics

3. **Deployment Execution**
   - Parallel deployment where possible
   - Circuit breakers for fault tolerance
   - Real-time monitoring

4. **Post-deployment**
   - Health checks
   - Performance benchmarking
   - Update pattern recognition
   - Log results for future optimization

// turbo
5. **Continuous Optimization**
   - Adjust strategies based on real-world performance
   - Update Monte Carlo models
   - Refine auto-selection weights
