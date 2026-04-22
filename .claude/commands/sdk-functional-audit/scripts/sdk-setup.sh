#!/usr/bin/env bash
set -euo pipefail

SDK_DIR="${1:?Usage: sdk-setup.sh <SDK_DIR> [ENV_FILE]}"
ENV_FILE="${2:-}"

RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sdk-audit-XXXXXXXXXX")"
mkdir -p "$RUN_DIR/setup" "$RUN_DIR/providers" "$RUN_DIR/regression/entries"
chmod 700 "$RUN_DIR"

NODE_VERSION=$(node --version 2>/dev/null || echo "")
if [[ -z "$NODE_VERSION" ]]; then
  echo "FATAL: Node.js not found in PATH" >&2
  exit 1
fi

NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "FATAL: Node.js >= 18 required, found $NODE_VERSION" >&2
  exit 1
fi
echo "$NODE_VERSION" > "$RUN_DIR/setup/node-version.txt"

if [[ ! -d "$SDK_DIR/node_modules" ]]; then
  echo "FATAL: node_modules not found in $SDK_DIR — run npm ci first" >&2
  exit 1
fi

if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

REVENIUM_METERING_API_KEY="${REVENIUM_METERING_API_KEY:-}"
REVENIUM_METERING_BASE_URL="${REVENIUM_METERING_BASE_URL:-https://api.revenium.ai}"

if [[ -z "$REVENIUM_METERING_API_KEY" ]]; then
  echo "WARNING: REVENIUM_METERING_API_KEY not set — metering round-trip tests will be limited" >&2
fi

cat > "$RUN_DIR/setup/env.sh" <<ENVEOF
export SDK_DIR="$SDK_DIR"
export RUN_DIR="$RUN_DIR"
export REVENIUM_METERING_API_KEY="${REVENIUM_METERING_API_KEY}"
export REVENIUM_METERING_BASE_URL="${REVENIUM_METERING_BASE_URL}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"
export AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY:-}"
export AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-}"
export AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
export GOOGLE_API_KEY="${GOOGLE_API_KEY:-}"
export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-}"
export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-}"
export GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-}"
export PERPLEXITY_API_KEY="${PERPLEXITY_API_KEY:-}"
export LITELLM_PROXY_URL="${LITELLM_PROXY_URL:-}"
export LITELLM_API_KEY="${LITELLM_API_KEY:-}"
export FAL_KEY="${FAL_KEY:-}"
ENVEOF
chmod 600 "$RUN_DIR/setup/env.sh"

declare -A PROVIDERS=(
  [openai]="OPENAI_API_KEY"
  [azure]="AZURE_OPENAI_API_KEY"
  [anthropic]="ANTHROPIC_API_KEY"
  [google-genai]="GOOGLE_API_KEY"
  [google-vertex]="GOOGLE_CLOUD_PROJECT"
  [perplexity]="PERPLEXITY_API_KEY"
  [litellm]="LITELLM_PROXY_URL"
  [fal]="FAL_KEY"
)

PROVIDERS_JSON="{}"
for provider in "${!PROVIDERS[@]}"; do
  var="${PROVIDERS[$provider]}"
  val="${!var:-}"
  has_creds="false"
  if [[ -n "$val" ]]; then
    has_creds="true"
  fi
  PROVIDERS_JSON=$(echo "$PROVIDERS_JSON" | jq \
    --arg p "$provider" \
    --arg v "$var" \
    --argjson c "$has_creds" \
    '.[$p] = {"env_var": $v, "has_credentials": $c}')
done
echo "$PROVIDERS_JSON" > "$RUN_DIR/setup/providers.json"

echo "SDK Audit pre-flight complete" >&2
echo "  Node.js: $NODE_VERSION" >&2
echo "  SDK_DIR: $SDK_DIR" >&2
echo "  RUN_DIR: $RUN_DIR" >&2
echo "  Revenium key: $(if [[ -n "$REVENIUM_METERING_API_KEY" ]]; then echo 'set'; else echo 'NOT SET'; fi)" >&2

CRED_COUNT=0
for provider in "${!PROVIDERS[@]}"; do
  var="${PROVIDERS[$provider]}"
  if [[ -n "${!var:-}" ]]; then
    CRED_COUNT=$((CRED_COUNT + 1))
  fi
done
echo "  Provider credentials: ${CRED_COUNT}/8 configured" >&2

echo "$RUN_DIR"
