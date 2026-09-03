---
description: Drive the running app through the Playwright MCP tools as a real user and report what works. Usage: /e2e [base-url]
allowed-tools: Agent
---
Launch the `erp-qa` agent with base URL ${ARGUMENTS:-http://localhost:3000}. Relay its findings table and fix any defects it confirms.
