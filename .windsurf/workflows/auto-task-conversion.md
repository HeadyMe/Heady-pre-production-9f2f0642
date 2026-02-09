---
description: Automatically convert recommendations and suggestions into tasks
---

1. **Capture Recommendations**:
   - Monitor system outputs (chat, logs, events) for phrases like "I recommend", "You should", "Consider", etc.
   - Extract the recommendation text

2. **Classify Priority**:
   - Use Pattern Engine to assign priority:
     - High: Critical errors, security issues
     - Medium: Performance improvements, UX enhancements
     - Low: Documentation, minor refactors

3. **Create Task**:
   - Call `todo_list` tool with:
     - Content: The recommendation text
     - Status: pending
     - Priority: As classified

4. **Notify User**:
   - Send HeadyBuddy notification: "New task created: [task content]"

5. **Log Creation**:
   - Record task creation in system log for audit
