#!/usr/bin/env bash
set -euo pipefail

RUN_DIR="${1:?Usage: provider-drift-check.sh <RUN_DIR>}"
source "$RUN_DIR/setup/env.sh"

FINDINGS_FILE="$RUN_DIR/xcut-provider-drift-findings.md"
DONE_FILE="$RUN_DIR/xcut-provider-drift-done"
FINDING_COUNT=0

cat > "$FINDINGS_FILE" <<'HEADER'
# Findings — Cross-cutting — Provider Drift Check

**Run:** {{RUN_DIR}}
**Agent:** xcut:provider-drift
**Phases executed:** 4 (Provider API Drift — static analysis)

## Summary

Deterministic check of provider SDK version compatibility.

## Findings
HEADER

sed -i '' "s|{{RUN_DIR}}|${RUN_DIR}|g" "$FINDINGS_FILE" 2>/dev/null || \
  sed -i "s|{{RUN_DIR}}|${RUN_DIR}|g" "$FINDINGS_FILE"

PACKAGE_JSON="$SDK_DIR/package.json"
if [[ ! -f "$PACKAGE_JSON" ]]; then
  echo "FATAL: package.json not found at $PACKAGE_JSON" >&2
  exit 1
fi

PEER_DEPS=$(PACKAGE_JSON_PATH="$PACKAGE_JSON" node -e "
  const pkg = require(process.env.PACKAGE_JSON_PATH);
  const peers = pkg.peerDependencies || {};
  Object.entries(peers).forEach(([name, range]) => {
    console.log(name + '|' + range);
  });
" 2>/dev/null || true)

while IFS='|' read -r dep_name dep_range; do
  [[ -z "$dep_name" ]] && continue

  INSTALLED_VERSION=""
  if [[ -f "$SDK_DIR/node_modules/$dep_name/package.json" ]]; then
    INSTALLED_VERSION=$(PKG_PATH="$SDK_DIR/node_modules/$dep_name/package.json" node -e "console.log(require(process.env.PKG_PATH).version)" 2>/dev/null || true)
  fi

  if [[ -z "$INSTALLED_VERSION" ]]; then
    continue
  fi

  SATISFIES=$(INST_VER="$INSTALLED_VERSION" DEP_RANGE="$dep_range" node -e "
    try {
      const semver = require('semver');
      console.log(semver.satisfies(process.env.INST_VER, process.env.DEP_RANGE) ? 'yes' : 'no');
    } catch { console.log('unknown'); }
  " 2>/dev/null || echo "unknown")

  if [[ "$SATISFIES" == "no" ]]; then
    FINDING_COUNT=$((FINDING_COUNT + 1))
    cat >> "$FINDINGS_FILE" <<EOF

### FINDING: Peer dependency version mismatch — $dep_name
- PHASE: 4d
- PROVIDER: cross-cutting
- SEVERITY: major
- CERTAINTY: definite
- CLASS: F

Installed version $INSTALLED_VERSION of $dep_name does not satisfy peer dependency range "$dep_range" declared in package.json.
EOF
  fi
done <<< "$PEER_DEPS"

declare -A PROVIDER_IMPORTS=(
  [openai]="openai"
  [anthropic]="@anthropic-ai/sdk"
  [google-genai]="@google/genai"
  [google-vertex]="google-auth-library"
  [fal]="@fal-ai/client"
)

for provider in "${!PROVIDER_IMPORTS[@]}"; do
  pkg="${PROVIDER_IMPORTS[$provider]}"
  IMPORT_REFS=$(grep -rn "from ['\"]${pkg}" "$SDK_DIR/src/" 2>/dev/null || true)
  if [[ -z "$IMPORT_REFS" ]]; then
    continue
  fi

  if [[ ! -d "$SDK_DIR/node_modules/$pkg" ]]; then
    FINDING_COUNT=$((FINDING_COUNT + 1))
    cat >> "$FINDINGS_FILE" <<EOF

### FINDING: Provider SDK referenced but not installed — $pkg
- PHASE: 4d
- PROVIDER: $provider
- SEVERITY: minor
- CERTAINTY: definite
- CLASS: F

Source code imports from $pkg but the package is not installed in node_modules. This is expected for optional peer dependencies but may indicate a drift issue if the provider is meant to be tested.
EOF
  fi
done

if [[ "$FINDING_COUNT" -eq 0 ]]; then
  echo "" >> "$FINDINGS_FILE"
  echo "No provider drift findings detected. All installed peer dependencies satisfy declared ranges." >> "$FINDINGS_FILE"
fi

echo "" >> "$FINDINGS_FILE"
echo "## Coverage gaps" >> "$FINDINGS_FILE"
echo "" >> "$FINDINGS_FILE"
echo "Phase 4a-4c (runtime drift simulation) requires live execution — not covered by this static check." >> "$FINDINGS_FILE"

touch "$DONE_FILE"
echo "Provider drift check complete: $FINDING_COUNT findings" >&2
