#!/usr/bin/env bash
set -euo pipefail

RUN_DIR="${1:?Usage: wait-for-agents.sh <RUN_DIR> <expected_count> <prefix> <timeout_seconds>}"
EXPECTED="${2:?Expected count required}"
PREFIX="${3:?Prefix required (domain or regression)}"
TIMEOUT="${4:-900}"

COMBINED="$RUN_DIR/${PREFIX}-combined-report.md"
ELAPSED=0
INTERVAL=5

while [[ "$ELAPSED" -lt "$TIMEOUT" ]]; do
  DONE_COUNT=$(find "$RUN_DIR" -maxdepth 1 -name "${PREFIX}-*-done" 2>/dev/null | wc -l | tr -d ' ')

  if [[ "$DONE_COUNT" -ge "$EXPECTED" ]]; then
    break
  fi

  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

DONE_COUNT=$(find "$RUN_DIR" -maxdepth 1 -name "${PREFIX}-*-done" 2>/dev/null | wc -l | tr -d ' ')

> "$COMBINED"
echo "# ${PREFIX^} Combined Report" >> "$COMBINED"
echo "" >> "$COMBINED"
echo "**Agents completed:** ${DONE_COUNT}/${EXPECTED}" >> "$COMBINED"
echo "" >> "$COMBINED"

for f in "$RUN_DIR"/${PREFIX}-*-findings.md; do
  [[ ! -f "$f" ]] && continue
  CONTENT=$(head -c 10240 "$f")
  echo "$CONTENT" >> "$COMBINED"
  echo "" >> "$COMBINED"
  echo "---" >> "$COMBINED"
  echo "" >> "$COMBINED"
done

if [[ "$DONE_COUNT" -lt "$EXPECTED" ]]; then
  echo "WARNING: ${DONE_COUNT}/${EXPECTED} agents completed within ${TIMEOUT}s timeout" >&2
  MISSING=$((EXPECTED - DONE_COUNT))
  echo "" >> "$COMBINED"
  echo "**WARNING:** ${MISSING} agent(s) did not complete within the ${TIMEOUT}s timeout." >> "$COMBINED"
  exit 1
fi

echo "All ${EXPECTED} ${PREFIX} agents completed." >&2
exit 0
