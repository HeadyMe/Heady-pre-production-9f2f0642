---
description: Arena Mode Operations Workflow
---
# Arena Mode Operations Workflow

## Trigger Conditions
- User initiates an Arena run for a feature/app/vertical
- HeadyAutoIDE identifies multiple viable design approaches

## Steps
1. **Capture and frame** problem statement, user, vertical
2. **Generate 2-4 candidate designs** using Multi-Base Fusion
3. **Score candidates** against 5 criteria (ownership clarity, redundancy removal, etc.)
4. **Select winner** and squash-merge implementation
5. **Log ARENA_WINNER_CHOSEN** event with StoryDriver
6. **Produce next 3 steps** for productionization

## Integration Points
- Uses HCFullPipeline for build experiments
- Registers winners in heady-registry.json
- Updates Connection Kits for new components
