---
description: Audit the codebase against docs/SECURITY.md and report gaps with file:line references.
allowed-tools: Bash, Read, Grep, Glob, Agent
---
Launch the `security-reviewer` agent on the current tree. Then run `pnpm audit --audit-level high` and `grep -rn "dangerouslySetInnerHTML\|eval(\|process.env" src | grep -v "process.env.NODE_ENV"`. Summarise findings by severity; do not fix without confirmation unless trivial.
