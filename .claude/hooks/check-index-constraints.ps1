# =============================================================================
# check-index-constraints.ps1  —  project PostToolUse guard
#
# Runs after Claude edits a file. If index.html was touched, it re-checks the
# hard constraints from CLAUDE.md (no inline handlers, no storage APIs, no
# browser dialogs, no external URLs / CDN tags). On a violation it exits 2 so
# the offending pattern is fed back to Claude to fix.
#
# Wired in .claude/settings.json under hooks.PostToolUse (Edit|Write|MultiEdit).
# =============================================================================

$ErrorActionPreference = 'Stop'

# --- Read the hook payload from stdin -----------------------------------------
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try { $payload = $raw | ConvertFrom-Json } catch { exit 0 }

# --- Collect every file path the tool call touched --------------------------
$ti = $payload.tool_input
$paths = @()
if ($ti.file_path)  { $paths += $ti.file_path }
if ($ti.edits)      { foreach ($e in $ti.edits) { if ($e.file_path) { $paths += $e.file_path } } }

$touchedIndex = $paths | Where-Object { $_ -and (Split-Path $_ -Leaf) -ieq 'index.html' }
if (-not $touchedIndex) { exit 0 }

# --- Resolve index.html relative to the project root -----------------------
$root = $env:CLAUDE_PROJECT_DIR
if (-not $root) { $root = (Get-Location).Path }
$index = Join-Path $root 'index.html'
if (-not (Test-Path $index)) { exit 0 }

# --- The forbidden-pattern check from CLAUDE.md ----------------------------
$pattern = 'onclick=|localStorage|sessionStorage|alert\(|confirm\(|https?://|<script src|<link'
$hits = Select-String -Path $index -Pattern $pattern -AllMatches

if ($hits) {
    $lines = $hits | ForEach-Object { "  index.html:$($_.LineNumber): $($_.Line.Trim())" }
    [Console]::Error.WriteLine("index.html violates a hard constraint from CLAUDE.md (expected zero matches):")
    [Console]::Error.WriteLine(($lines -join "`n"))
    [Console]::Error.WriteLine("")
    [Console]::Error.WriteLine("Forbidden: inline onclick=, localStorage/sessionStorage, alert()/confirm(), any http(s):// URL, <script src>, <link>. Rework the change to keep everything inline and offline-safe.")
    exit 2
}

exit 0
