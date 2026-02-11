---
description: Teaching Coding Protocol - Focus on self-awareness and how to code right now
---
# Teaching Coding Protocol

This workflow implements a 10-step method to teach coding to the system with a focus on self-awareness and "how to code right now".

## Steps

1. **Define the “self” we are training**: Start every coding session by writing a "self-header" that includes:
   - Role (e.g., implementation agent, review agent)
   - Goal for the session
   - Constraints (style, domains, safety, performance, test coverage)

2. **Use a tight “Minute 0–10” loop for each coding task**:
   - Minute 0–2: Restate the task in your own words and list key risks
   - Minute 2–4: Sketch minimal design (functions, files, error handling, testing)
   - Minute 4–8: Write minimal viable code + tests
   - Minute 8–10: Self-critique and note next iterations

3. **Anchor self-awareness in the Iterative Rebuild mindset**: Treat every change as part of a rebuild cycle (ARCHIVE, SCAFFOLD, IMPLEMENT, TEST, REVIEW, DOCUMENT, RETRO)

4. **Embed coding standards as live constraints**: Before coding, prompt-inject a short checklist (URLs, domains, naming standards). Include a "standards audit" in self-review

5. **Make self-critique a first-class step for every code block**: After each non-trivial code block, answer:
   - Clarity
   - Correctness
   - Error handling
   - Tests
   - Simplicity

6. **Teach with paired roles: implementer and reviewer**: Simulate pair programming with two roles. The implementer writes code, the reviewer critiques

7. **Use micro-projects with explicit retrospectives**: After each micro-project, conduct a retro with:
   - New errors found
   - Repeated errors and why
   - Safeguards that worked/failed
   - Process changes for next time

8. **Track and compress error patterns over time**: Maintain an "error catalog". Periodically analyze and adopt new rules to prevent common errors

9. **Hard bias toward reliability over speed**: Explicitly label compromises and create concrete follow-up tasks for technical debt

10. **Daily practice script**: Run the Minute 0-10 loop daily, enforce paired roles, and update the error catalog and checklists
