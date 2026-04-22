#!/usr/bin/env bash
set -euo pipefail

RUN_DIR="${1:?Usage: security-lint.sh <RUN_DIR>}"
source "$RUN_DIR/setup/env.sh"

FINDINGS_FILE="$RUN_DIR/xcut-security-lint-findings.md"
DONE_FILE="$RUN_DIR/xcut-security-lint-done"
FINDING_COUNT=0

cat > "$FINDINGS_FILE" <<'HEADER'
# Findings — Cross-cutting — Security Lint

**Run:** {{RUN_DIR}}
**Agent:** xcut:security-lint
**Phases executed:** 7 (Security Lint)

## Summary

Deterministic security lint scan of SDK source code.

## Findings
HEADER

sed -i '' "s|{{RUN_DIR}}|${RUN_DIR}|g" "$FINDINGS_FILE" 2>/dev/null || \
  sed -i "s|{{RUN_DIR}}|${RUN_DIR}|g" "$FINDINGS_FILE"

API_KEY_PATTERNS='(sk-[a-zA-Z0-9]{20,}|hak_[a-zA-Z0-9]{10,}|sk-ant-[a-zA-Z0-9]{10,}|pplx-[a-zA-Z0-9]{10,}|AIza[a-zA-Z0-9]{20,})'

HARDCODED=$(grep -rn -E "$API_KEY_PATTERNS" "$SDK_DIR/src/" 2>/dev/null || true)
if [[ -n "$HARDCODED" ]]; then
  FINDING_COUNT=$((FINDING_COUNT + 1))
  cat >> "$FINDINGS_FILE" <<EOF

### FINDING: Hardcoded API key pattern detected in source
- PHASE: 7d
- PROVIDER: cross-cutting
- SEVERITY: critical
- CERTAINTY: probable
- CLASS: H

Patterns matching known API key formats found in source code:
\`\`\`
${HARDCODED}
\`\`\`
EOF
fi

CONSOLE_LEAK=$(grep -rn -E 'console\.(log|debug|info|warn|error).*(_API_KEY|_SECRET|apiKey|secret|password|credential)' "$SDK_DIR/src/" 2>/dev/null || true)
if [[ -n "$CONSOLE_LEAK" ]]; then
  FINDING_COUNT=$((FINDING_COUNT + 1))
  cat >> "$FINDINGS_FILE" <<EOF

### FINDING: Potential secret leak in console output
- PHASE: 7a
- PROVIDER: cross-cutting
- SEVERITY: major
- CERTAINTY: probable
- CLASS: H

Console statements reference sensitive variable names:
\`\`\`
${CONSOLE_LEAK}
\`\`\`
EOF
fi

PAYLOAD_LEAK=$(grep -rn -E '(apiKey|api_key|authorization|secret)' "$SDK_DIR/src/_core/metering/payload-builder.ts" 2>/dev/null || true)
if [[ -n "$PAYLOAD_LEAK" ]]; then
  IS_EXCLUDED=$(echo "$PAYLOAD_LEAK" | grep -v 'exclude\|redact\|mask\|filter\|omit' || true)
  if [[ -n "$IS_EXCLUDED" ]]; then
    FINDING_COUNT=$((FINDING_COUNT + 1))
    cat >> "$FINDINGS_FILE" <<EOF

### FINDING: Payload builder references credential fields
- PHASE: 7b
- PROVIDER: cross-cutting
- SEVERITY: major
- CERTAINTY: possible
- CLASS: H

The metering payload builder references credential-related field names. Verify these are excluded from the payload:
\`\`\`
${IS_EXCLUDED}
\`\`\`
EOF
  fi
fi

STRINGIFY_CONFIG=$(grep -rn 'JSON\.stringify.*[Cc]onfig' "$SDK_DIR/src/" 2>/dev/null || true)
if [[ -n "$STRINGIFY_CONFIG" ]]; then
  FINDING_COUNT=$((FINDING_COUNT + 1))
  cat >> "$FINDINGS_FILE" <<EOF

### FINDING: JSON.stringify of config object without redaction
- PHASE: 7a
- PROVIDER: cross-cutting
- SEVERITY: minor
- CERTAINTY: possible
- CLASS: H

Config objects serialized without explicit field filtering:
\`\`\`
${STRINGIFY_CONFIG}
\`\`\`
EOF
fi

if [[ "$FINDING_COUNT" -eq 0 ]]; then
  echo "" >> "$FINDINGS_FILE"
  echo "No security findings detected." >> "$FINDINGS_FILE"
fi

echo "" >> "$FINDINGS_FILE"
echo "## Coverage gaps" >> "$FINDINGS_FILE"
echo "" >> "$FINDINGS_FILE"
echo "Phase 7c (runtime debug mode audit) requires live execution — not covered by this static lint." >> "$FINDINGS_FILE"

touch "$DONE_FILE"
echo "Security lint complete: $FINDING_COUNT findings" >&2
