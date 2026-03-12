description: Force a context refresh from the working memory file
mode: ask
help: Recover from context amnesia by reloading the working memory file
---
You are recovering from context amnesia.
1. Read the file `docs/working_memory/<active_file>.md`. If the active file is not provided, enumerate `docs/working_memory/` and pick the most recent entry (ask the user when in doubt).
2. **IGNORE** your internal conversation history about the plan; trust ONLY the working memory file.
3. Output a summary in this exact format:
   - **Objective:** [Objective from file]
   - **Status:** [Current State from file]
   - **Immediate Next Step:** [The very first action from "Next action"]
4. Ask me: "Shall we proceed with [Immediate Next Step]?" before doing anything else.
