---
description: Smoke test a deployed URL (health, security headers, login page, API 401). Usage: /smoke <url>
allowed-tools: Bash
---
For `$ARGUMENTS`: `curl -fsS $URL/api/health`, `curl -sI $URL/login | grep -iE "strict-transport|content-security|x-frame"`, `curl -s -o /dev/null -w "%{http_code}" $URL/api/v1/low-stock` (expect 401), `curl -s -o /dev/null -w "%{http_code}" $URL/dev/mailbox` (expect 404 in production). Report a table.
