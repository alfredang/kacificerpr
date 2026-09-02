---
description: Publish this project to GitHub — secret scan, push, README, About section, and GitHub Pages via Actions.
argument-hint: <owner/repo> [--public|--private] [--branch <name>]
allowed-tools: PowerShell, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

Publish this project to a GitHub repository, end to end.

Repo details supplied by the user: **$ARGUMENTS**

If `$ARGUMENTS` is empty or does not contain an `owner/repo` slug, ask the user for:
the repo slug (`owner/repo`), whether it should be **public or private**, and whether
GitHub Pages should be enabled. Do not guess a repo name. Never create or push to a
repository the user did not name.

Defaults when unspecified: visibility **private**, branch **main**, Pages **enabled**
(Pages requires a public repo on GitHub Free — if the user picked private, say so and
either ask them to make it public or skip step 5).

Work through the steps in order. **Step 2 is a hard gate: nothing is pushed until the
secret scan is clean and the user has approved the file list.** Scanning after upload
is worthless — a pushed secret is a leaked secret even if the commit is later deleted.

---

## Step 1 — Preflight

```powershell
git --version
gh --version
gh auth status
```

- If `git` is missing: stop and tell the user to install Git for Windows
  (`winget install --id Git.Git -e`), then re-run. Do not attempt to push without it.
- If `gh` is missing: stop and tell the user to install the GitHub CLI
  (`winget install --id GitHub.cli -e`), then re-run. Steps 4 and 5 need it.
- If `gh auth status` reports not logged in: tell the user to run `gh auth login` in an
  interactive terminal. **Never ask the user to paste a token, password, or device code
  into this conversation, and never write a token into a file.**

Then check the working tree:

```powershell
git rev-parse --is-inside-work-tree
git status --porcelain
git remote -v
```

Note whether this is already a repo and whether an `origin` remote already exists.

## Step 2 — Secret and PII scan (blocking)

### 2a. Enumerate exactly what would be uploaded

```powershell
Get-ChildItem -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch '\\(\.git|node_modules)\\' } |
  Select-Object @{n='Path';e={Resolve-Path -Relative $_.FullName}}, Length
```

If a `.gitignore` exists, prefer `git status --porcelain --untracked-files=all` plus
`git ls-files` so the list reflects real tracking rules.

### 2b. Scan content for credentials and PII

```powershell
$patterns = @(
  'password\s*[:=]', 'passwd', 'secret\s*[:=]', 'api[_-]?key', 'apikey',
  'access[_-]?token', 'auth[_-]?token', 'bearer\s+[A-Za-z0-9\-\._~\+/]{20,}',
  'client[_-]?secret', 'private[_-]?key', 'BEGIN (RSA|OPENSSH|EC|PGP|DSA) PRIVATE KEY',
  'AKIA[0-9A-Z]{16}', 'ASIA[0-9A-Z]{16}', 'aws_secret_access_key',
  'ghp_[A-Za-z0-9]{36}', 'gho_[A-Za-z0-9]{36}', 'github_pat_[A-Za-z0-9_]{22,}',
  'xox[baprs]-[A-Za-z0-9-]{10,}', 'sk-[A-Za-z0-9]{20,}', 'sk-ant-[A-Za-z0-9\-_]{20,}',
  'AIza[0-9A-Za-z\-_]{35}', '-----BEGIN CERTIFICATE-----',
  'connection\s*string', 'Data Source=.*Password=', 'mongodb(\+srv)?://[^\s]*:[^\s]*@',
  'postgres(ql)?://[^\s]*:[^\s]*@', 'mysql://[^\s]*:[^\s]*@',
  'Server=.*;.*Pwd=', 'SharedAccessSignature', 'DefaultEndpointsProtocol=.*AccountKey='
) -join '|'
Get-ChildItem -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch '\\(\.git|node_modules)\\' } |
  Select-String -Pattern $patterns -AllMatches |
  Select-Object Path, LineNumber, Line
```

Then PII, separately (these produce more false positives — read the hits, don't just
count them):

```powershell
$pii = @(
  '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',   # email addresses
  '\b(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}\b',  # phone numbers
  '\b\d{3}-\d{2}-\d{4}\b',                             # US SSN
  '\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b' # card
) -join '|'
Get-ChildItem -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch '\\(\.git|node_modules)\\' } |
  Select-String -Pattern $pii -AllMatches |
  Select-Object Path, LineNumber, Line
```

Also flag by filename, whatever their contents:

```powershell
Get-ChildItem -Recurse -File -Force -Include `
  '.env','.env.*','*.pem','*.key','*.pfx','*.p12','*.jks','*.keystore', `
  'id_rsa','id_ed25519','*.ppk','credentials','*.sqlite','*.mdb','*.bak', `
  'secrets.*','*secret*.json','*credential*.json','.npmrc','.netrc','.pypirc' |
  Select-Object FullName
```

And if this is already a git repo, check that history is clean too — a secret removed
from the working tree still ships in an old commit:

```powershell
git log --all --oneline
git grep -nEI $patterns $(git rev-list --all) -- . 2>$null | Select-Object -First 50
```

### 2c. Judge the results, then gate

Read every hit yourself; do not just report counts. Classify each as:

- **Real secret / real PII** → BLOCK.
- **False positive** (a CSS class named `key`, the word "password" in a `<label>`, a
  placeholder like `YOUR_API_KEY_HERE`, an example address like `user@example.com`) →
  note it and move on.
- **Uncertain** → treat it as real and ask the user.

If anything is BLOCKed: **do not push.** Report the file, line number, and matched
content (redact the secret value itself — show `sk-ant-****` not the key). Offer the
concrete fix — remove the value, replace it with an env var or placeholder, add the file
to `.gitignore`, or scrub history — and wait for the user's decision. If a live
credential was found anywhere in history, tell the user to **rotate it**, because the
value must be considered compromised regardless of what the repo ends up containing.

If the scan is clean, show the user the exact file list from 2a and the repo slug and
visibility, and get an explicit go-ahead before the first push. Publishing is
outward-facing and effectively irreversible.

### 2d. Project constraint check

This repo has hard constraints in `CLAUDE.md` that a publish must not break:

```powershell
Select-String -Path index.html -Pattern 'onclick=|localStorage|sessionStorage|alert\(|confirm\(|https?://|<script src|<link' -AllMatches
```

Expect zero matches. If there are matches, report them and stop — that is a regression,
not something to publish over.

## Step 3 — Initialise, commit, and push

Create a `.gitignore` first if there isn't one, covering at minimum:
`.env`, `.env.*`, `*.pem`, `*.key`, `*.pfx`, `node_modules/`, `.DS_Store`, `Thumbs.db`,
`*.log`, `.vscode/`, and any file the scan flagged that the user wants kept locally.

```powershell
git init -b main
git add -A
git status --short          # show the user what is staged, one last look
git commit -m @'
Initial commit: LogiTrack Inventory dashboard

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

Create the remote repo (only if it does not already exist — check with
`gh repo view <owner/repo>` first) and push:

```powershell
gh repo create <owner/repo> --private --source=. --remote=origin --push
```

Use `--public` instead of `--private` if the user chose public. If the repo already
exists, wire it up manually instead:

```powershell
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

If the push is rejected because the remote has commits, **do not force-push.** Report it
and ask whether to pull and rebase or use a different repo.

## Step 4 — README

Read `CLAUDE.md` and `index.html` first so the README describes what is actually there.
Create or update `README.md` with:

- Project title and a one-line description.
- What it does and who it is for.
- **Run it** — this app is a single file; `start index.html` or open it in a browser.
  No build step, no dependencies.
- Data notes: the seed data renders as 14 SKUs / 27,134 units / 5 below reorder /
  4 warehouses, and `inventory.csv` is a static snapshot, not a live export.
- Constraints worth knowing (single file, in-memory state that resets on reload,
  offline-capable, no external assets).
- Accessibility notes.
- A live demo link once step 5 gives you the Pages URL.
- Licence, if the user names one.

If a `README.md` already exists, **edit it** — preserve sections the user wrote, update
what is stale. Do not overwrite it wholesale. Commit and push the change.

## Step 5 — GitHub About section

The About panel is repo metadata, not a file. Set it with:

```powershell
gh repo edit <owner/repo> `
  --description "Single-file warehouse stock dashboard — filter, sort and track SKUs, no build step" `
  --homepage "https://<owner>.github.io/<repo>/" `
  --add-topic inventory-management `
  --add-topic dashboard `
  --add-topic vanilla-javascript `
  --add-topic single-file `
  --add-topic accessibility `
  --add-topic no-build
```

Keep the description under ~120 characters. Set `--homepage` to the Pages URL from step 6
(run this again after Pages is live if you don't have the URL yet). Propose the
description and topics to the user before applying if they haven't specified them.

## Step 6 — GitHub Pages via Actions

Write `.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

The site root is the repo root because `index.html` sits there — that is also what makes
the app work when opened straight off disk. Do not add a build step.

Enable Pages in Actions mode, push the workflow, and watch the run:

```powershell
gh api --method POST repos/<owner>/<repo>/pages -f build_type=workflow
git add .github/workflows/pages.yml
git commit -m @'
Add GitHub Pages deployment workflow

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
git push
gh run watch
```

If the `pages` API call returns 409, Pages is already enabled — switch it instead:

```powershell
gh api --method PUT repos/<owner>/<repo>/pages -f build_type=workflow
```

If it returns 403 on a private repo, Pages is not available on that plan — report it and
leave Pages off rather than flipping the repo to public unasked.

Confirm the deployed URL:

```powershell
gh api repos/<owner>/<repo>/pages --jq .html_url
```

Then go back and finish step 5's `--homepage` and the README demo link with that URL,
and commit the README change.

## Step 7 — Report

Tell the user, plainly:

- Repo URL and visibility.
- Live Pages URL (or why Pages is off).
- What the secret scan found: clean, or the specific items and how they were handled.
- Files pushed, and anything deliberately excluded via `.gitignore`.
- Any step that did not complete, and why. If a step failed, say so with the actual
  error output — do not report success for work that did not happen.
