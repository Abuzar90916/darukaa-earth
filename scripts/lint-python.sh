#!/bin/sh
# Runs Ruff on the staged Python files passed as arguments.
#
# Ruff is resolved from the backend virtualenv first, then from PATH. When it is
# not installed at all (a frontend-only checkout), the hook prints a note and
# lets the commit through instead of blocking it — CI still enforces Ruff.
set -e

if [ "$#" -eq 0 ]; then
  exit 0
fi

if [ -x "backend/.venv/bin/ruff" ]; then
  RUFF="backend/.venv/bin/ruff"
elif command -v ruff >/dev/null 2>&1; then
  RUFF="ruff"
else
  echo "ruff not found locally - skipping Python checks (CI will still run them)"
  exit 0
fi

"$RUFF" check --fix "$@"
"$RUFF" format "$@"
