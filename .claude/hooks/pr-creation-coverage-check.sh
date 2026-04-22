#!/usr/bin/env bash
set -e

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")

if [[ "$tool_name" != "Bash" ]]; then
  exit 0
fi

cwd=$(echo "$input" | jq -r '.cwd // empty' 2>/dev/null || echo "")
if [[ "$cwd" != *"revenium-middleware-node"* ]]; then
  exit 0
fi

command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

gh_pr_create_regex='gh[[:space:]]+pr[[:space:]]+create'
if ! echo "$command" | grep -qE "(create-pr\.sh|${gh_pr_create_regex})"; then
  exit 0
fi

stdout=$(echo "$input" | jq -r '.tool_response.stdout // empty' 2>/dev/null || echo "")
if ! echo "$stdout" | grep -q "github.com"; then
  exit 0
fi

cd "$cwd" 2>/dev/null || exit 0

base_branch=""
if [[ "$command" =~ --base[[:space:]]+([^[:space:]]+) ]]; then
  base_branch="${BASH_REMATCH[1]}"
elif [[ "$command" =~ -B[[:space:]]+([^[:space:]]+) ]]; then
  base_branch="${BASH_REMATCH[1]}"
fi
if [[ -z "$base_branch" ]]; then
  base_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || echo "")
fi
if [[ -z "$base_branch" ]]; then
  base_branch="main"
fi
base_ref="origin/${base_branch}"
if ! git rev-parse --verify --quiet "$base_ref" >/dev/null 2>&1; then
  base_ref="origin/main"
fi

subjects=$(git log "${base_ref}..HEAD" --format='%s' 2>/dev/null || echo "")
messages=$(git log "${base_ref}..HEAD" --format='%B' 2>/dev/null || echo "")
is_bug_fix="false"
if echo "$subjects" | grep -qiE '^fix(\([^)]*\))?!?:'; then
  is_bug_fix="true"
elif echo "$messages" | grep -qiE '\b(resolves|fixes|closes)[[:space:]]+#[0-9]+'; then
  is_bug_fix="true"
fi

new_provider_files=$(git diff "${base_ref}..HEAD" --name-only --diff-filter=A 2>/dev/null \
  | grep -E '^src/(openai|anthropic|google|perplexity|litellm|fal)/.+\.ts$' || true)

new_exports=$(git diff "${base_ref}..HEAD" -- src/index.ts 2>/dev/null \
  | grep -E '^\+.*export ' || true)

is_new_surface="false"
if [[ -n "$new_provider_files" || -n "$new_exports" ]]; then
  is_new_surface="true"
fi

if [[ "$is_bug_fix" == "false" && "$is_new_surface" == "false" ]]; then
  exit 0
fi

context_header="PR-CREATION COVERAGE CHECK: A PR was just created for revenium-middleware-node. Before finishing, update the SDK test-coverage artifacts so this change is reflected."

branch1=""
if [[ "$is_bug_fix" == "true" ]]; then
  branch1=$'\n\nBUG-FIX BRANCH — This PR appears to fix a bug. Before creating it, do the following:\n1. Classify the bug against the 13-class taxonomy in `.claude/commands/sdk-functional-testing.bug-classes.yaml` (classes A-M).\n2. Add a regression-test entry to `.claude/commands/sdk-functional-testing.regression-library.yaml` so this bug cannot silently reappear.\n3. Update `.claude/commands/sdk-test-coverage-matrix.yaml` for the provider x case-type cell this test fills.\n4. Reference the class letter and matrix cell in the PR body.'
fi

branch2=""
if [[ "$is_new_surface" == "true" ]]; then
  branch2=$'\n\nNEW-SURFACE BRANCH — This PR appears to add new provider integration or SDK surface area. Before creating it:\n1. Add test cases for the new functionality (happy path + relevant coverage matrix cells).\n2. Add a row or update cells in `.claude/commands/sdk-test-coverage-matrix.yaml`.\n3. Reference the matrix rows added in the PR body.'
fi

footer=$'\n\nReference files:\n- `.claude/commands/sdk-functional-testing.bug-classes.yaml`\n- `.claude/commands/sdk-test-coverage-matrix.yaml`\n- `.claude/commands/sdk-functional-testing.regression-library.yaml`\n\nThis check is important for keeping SDK test coverage current. Do not skip it.'

full_context="${context_header}${branch1}${branch2}${footer}"

echo "[pr-coverage-hook] Coverage check triggered (bug_fix=${is_bug_fix}, new_surface=${is_new_surface})" >&2

jq -n --arg ctx "$full_context" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
