---
description: Fire the scheduler once against the running app (same as Vercel Cron / the Docker sidecar).
allowed-tools: Bash
---
`pnpm cron:tick` — prints the tasks that ran. Check Settings → Scheduled tasks for the run log. To force a task regardless of schedule use “Run now” in the UI.
