#!/usr/bin/env bash
# Generates contracts/.test-summary.json from the real `forge test` result so the
# agent API reports the true pass count instead of a hardcoded number.
# Run from contracts/:  ./scripts/test-summary.sh   (or wire into CI)
set -euo pipefail
cd "$(dirname "$0")/.."

out="$(forge test 2>&1)"
echo "$out" | tail -1

passed="$(echo "$out" | grep -oE '[0-9]+ tests passed' | tail -1 | grep -oE '^[0-9]+' || echo "")"
total="$(echo "$out"  | grep -oE '\([0-9]+ total tests\)' | tail -1 | grep -oE '[0-9]+' || echo "")"

if [[ -z "$passed" || -z "$total" ]]; then
  echo "could not parse forge test summary" >&2
  exit 1
fi

printf '{"passed": %s, "total": %s, "generatedAt": "%s"}\n' \
  "$passed" "$total" "$(date -u +%FT%TZ)" > .test-summary.json
echo "wrote contracts/.test-summary.json -> $passed/$total"
