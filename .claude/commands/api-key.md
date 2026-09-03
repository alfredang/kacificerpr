---
description: Mint a Hermes/external API key. Usage: /api-key "<name>" <role> <scope,scope,…>
allowed-tools: Bash
---
Run `pnpm api-key $ARGUMENTS` (defaults: "Hermes agent" procurement read:stock,read:vendors,read:po,write:po,read:invoices). Show the key once and remind the user it cannot be recovered. Scopes: read:stock read:vendors read:po write:po approve:po read:invoices read:users impersonate.
