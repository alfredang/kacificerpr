#!/usr/bin/env bash
# PreToolUse(Bash): block commits/pushes that would add secrets or env files, and
# refuse commands that print .env files. Exit 2 blocks the tool call with a reason.
set -u
input=$(cat)
cmd=$(printf '%s' "$input" | sed -n 's/.*"command":"\(.*\)","description".*/\1/p' | head -1)
[ -z "$cmd" ] && cmd=$(printf '%s' "$input" | sed -n 's/.*"command":"\([^"]*\)".*/\1/p' | head -1)
case "$cmd" in
  *"cat .env"*|*"cat ./.env"*|*"cat .env.local"*|*"cat .env.docker"*)
    echo "Blocked: never print env files. Use grep -c or check for a key name instead." >&2; exit 2 ;;
esac
case "$cmd" in
  *"git commit"*|*"git push"*)
    cd "$(dirname "$0")/../.." || exit 0
    staged=$(git diff --cached --name-only 2>/dev/null)
    if printf '%s\n' "$staged" | grep -Eq '(^|/)\.env(\.docker|\.production)?$'; then
      echo "Blocked: a real .env file is staged (.env.local with dev-only values is the exception). Unstage it (git reset HEAD <file>)." >&2; exit 2
    fi
    if [ -n "$staged" ]; then
      hits=$(git diff --cached -U0 2>/dev/null | grep -E '^\+' | grep -E 'sk-[A-Za-z0-9]{20,}|kfc_live_[A-Za-z0-9_-]{20,}|whsec_[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{20,}|postgres(ql)?://[^ ]*:[^ ]*@|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|[0-9]{8,10}:[A-Za-z0-9_-]{35}' | grep -v 'example\|kfc_live_…\|placeholder' | head -3)
      if [ -n "$hits" ]; then
        echo "Blocked: staged diff looks like it contains a secret:" >&2; echo "$hits" >&2; exit 2
      fi
    fi ;;
esac
exit 0
