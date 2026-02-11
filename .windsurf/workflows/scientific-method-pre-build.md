---
description: Scientific Method Pre-Build Protocol for HCFullPipeline
---
# Scientific Method Pre-Build Protocol

This workflow embeds the scientific method as a mandatory pre-build stage in the HCFullPipeline.

## Steps

1. **Hypothesis stage (before plan)**:
   - HCBrain generates explicit hypotheses (e.g., "If we apply pattern X, error rate will improve by Z")
   - Structure each hypothesis: metric, expected change, time window, safety bounds

2. **Experiment design (in plan)**:
   - MonteCarloPlScheduler generates candidate action plans, each tagged with a hypothesis
   - Resource-policies and HCReadiness decide concurrency and aggressiveness based on ORS

3. **Simulation / Monte Carlo phase (before major execution)**:
   - Run Monte Carlo simulations over historical logs and patterns
   - Output: ranked plans, confidence scores, drift alerts

4. **Controlled execution (in execute-major-phase)**:
   - Execute only top plans that satisfy governance and readiness constraints

5. **Measurement and self-critique**:
   - SelfCritiqueEngine compares outcomes against hypotheses
   - PatternEngine updates convergence tracking
   - StoryDriver logs the experiment as a narrative

6. **Policy update**:
   - Successful hypotheses feed back into configs
   - Failed ones add guardrails or negative knowledge

### Integration with HCFullPipeline
This protocol is a required pre-stage for any autonomous build. It plugs into `hcfullpipeline.yaml` as a pre-stage.
