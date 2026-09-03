#!/usr/bin/env bash
# PostToolUse(Edit|Write): typecheck only when a TS/TSX file under src/, scripts/ or tests/ changed.
# Fails fast (exit 2 = surfaced to Claude) so type errors never accumulate.
set -u
input=$(cat)
file=$(printf '%s' "$input" | sed -n 's/.*"file_path":"\([^"]*\)".*/\1/p' | head -1)
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
case "$file" in
  */src/*|*/scripts/*|*/tests/*) ;;
  *) exit 0 ;;
esac
cd "$(dirname "$0")/../.." || exit 0
out=$(pnpm -s typecheck 2>&1)
status=$?
if [ $status -ne 0 ]; then
  echo "TypeScript errors after editing $file:" >&2
  echo "$out" | grep -E "error TS" | head -15 >&2
  exit 2
fi
exit 0
