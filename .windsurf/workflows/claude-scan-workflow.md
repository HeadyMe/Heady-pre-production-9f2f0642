<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: .windsurf/workflows/claude-scan-workflow.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
description: Iterative file scanning with Claude for project improvements
---

1. **Initialize**
   - Get list of all project files
   - Initialize empty results log

2. **Per-file processing**
   - For each file:
     a. Read file content
     b. Send to Claude with prompt:
        "Analyze this code and suggest specific improvements. Return ONLY the improved code sections with no explanations."
     c. Compare response with original
     d. If changes detected:
        - Apply changes
        - Log changes
        - Repeat step b
     e. If no changes:
        - Mark file as complete
        - Move to next file

3. **Finalize**
   - Generate summary report
   - Save all changes

4. **Integration**
   - Add any new patterns/concepts to Imagination Engine
   - Update documentation if needed
