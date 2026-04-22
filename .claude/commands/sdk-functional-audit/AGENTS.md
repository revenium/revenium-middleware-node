# Agent prompt templates — SDK Functional Audit

Five agent templates, one per role in the waved orchestrator:

- **Wave 1 (parallel, 4 agents)** — domain agents. Each owns a group of phases and runs them across all 8 providers.
- **Wave 2 (2 shell scripts, no agents)** — security-lint, provider-drift-check. Pattern-matching tasks that don't benefit from LLM reasoning.
- **Wave 3 (1 agent)** — regression library runner.

The orchestrator uses these templates verbatim when launching subagents. It parameterizes `{{DOMAIN}}`, `{{RUN_DIR}}`, `{{SDK_DIR}}`, `{{PROVIDER_FILTER}}`, `{{PHASE_FILTER}}` placeholders as needed.

---

## Shared rules — every agent follows these

1. **Read the phase prose from `{{SDK_DIR}}/.claude/commands/sdk-functional-testing.md`** by specific line ranges only — never read the whole file.

2. **Read setup artifacts from `{{RUN_DIR}}/setup/`** only as needed. `providers.json` lists detected providers and their configuration status.

3. **Write findings to `{{RUN_DIR}}/<prefix>-<id>-findings.md`** in the canonical format from `{{SDK_DIR}}/.claude/commands/sdk-functional-audit/OUTPUT.md`. Every finding needs structured `SEVERITY/CERTAINTY/CLASS/PHASE/PROVIDER` metadata lines.

4. **Write `{{RUN_DIR}}/<prefix>-<id>-done`** as the LAST action. Empty file. This signals `wait-for-agents.sh`.

5. **Test execution approach**: Use one of:
   - `npx jest --testPathPattern=<pattern>` for existing test suites
   - Ad-hoc Node.js scripts written to `/tmp/_sdk_audit/*/scripts/` for probes not covered by existing tests
   - Direct `node -e "..."` for quick assertions

6. **Provider API calls**: If real provider credentials are available (check `{{RUN_DIR}}/setup/env.sh`), use them for live validation. Otherwise, use jest.mock or fixture-based testing. Document which mode was used.

7. **Never escalate SEVERITY to force attention.** Follow OUTPUT.md's severity rules.

8. **All 8 providers must be accounted for** in every applicable phase. If a provider lacks credentials for live testing, run what you can with mocks and note the coverage gap.

---

## Template 1 — Metering Domain Agent

**Launched by orchestrator in Wave 1. Owns metering accuracy and data flow phases.**

```
You are Wave-1 Metering Domain Agent for SDK Functional Audit run {{RUN_DIR}}.

## Your phases

- Phase 5 (Request/Response Fidelity)
- Phase 8 (Streaming Validation)
- Phase 11 (Metering Round-trip)
- Phase 12 (Latency Overhead)

{{PHASE_FILTER}}: if set, restrict to only those phases.

## Providers

All 8: openai, azure, anthropic, google-genai, google-vertex, perplexity, litellm, fal
{{PROVIDER_FILTER}}: if set, restrict to only those providers.

## Execute

For each provider, in sequence:

1. **Phase 5 — Request/Response Fidelity**: Compare raw provider call vs
   SDK-wrapped call. Assert same status codes, response body shape, headers.
   Verify streaming chunks are not altered. Use mocked provider responses
   if no live credentials available.

2. **Phase 8 — Streaming Validation**: For providers that support streaming
   (openai, azure, anthropic, google-genai, perplexity, litellm), test SSE
   stream interception. Verify token counts are accurate across chunks.
   Verify metering fires after stream completion. Test stream interruption.
   fal.ai is n/a for streaming — skip with note.

3. **Phase 11 — Metering Round-trip**: Make an API call, capture the
   metering payload. Verify shape matches ReveniumPayload type. Verify
   token counts, model name, provider name, timestamps. If
   REVENIUM_METERING_BASE_URL points to a test endpoint, verify the POST.

4. **Phase 12 — Latency Overhead**: Measure raw vs wrapped call timing.
   Assert overhead <5%. Test under concurrent load (10 calls). Verify
   fire-and-forget doesn't block response delivery.

## Capture

- Findings: `{{RUN_DIR}}/domain-metering-findings.md`
- Test artifacts: `{{RUN_DIR}}/providers/<provider>/`

## Completion

Write `{{RUN_DIR}}/domain-metering-done` as the LAST action.
```

---

## Template 2 — Config Domain Agent

**Launched by orchestrator in Wave 1. Owns configuration and initialization testing.**

```
You are Wave-1 Config Domain Agent for SDK Functional Audit run {{RUN_DIR}}.

## Your phase

- Phase 6 (Config Integrity)

## Providers

All 8 providers. Each has unique config surface:
- openai: OPENAI_API_KEY, auto-detection of Azure
- azure: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_VERSION
- anthropic: ANTHROPIC_API_KEY, auto-patching on import
- google-genai: GOOGLE_API_KEY
- google-vertex: GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_LOCATION
- perplexity: PERPLEXITY_API_KEY
- litellm: LITELLM_PROXY_URL, LITELLM_API_KEY
- fal: FAL_KEY
- cross-cutting: REVENIUM_METERING_API_KEY, REVENIUM_METERING_BASE_URL, REVENIUM_DEBUG, REVENIUM_PRINT_SUMMARY

## Execute

For each provider:

1. **Config loading paths**: Test env vars, programmatic config, .env file
2. **Precedence**: programmatic > env var > default
3. **Missing config**: Verify clear error messages (not silent failures)
4. **Invalid config**: Wrong URL formats, empty strings, null values
5. **Runtime changes**: Re-initialization behavior
6. **Provider-specific**: Azure endpoint resolution, Google project detection,
   LiteLLM proxy URL validation

## Capture

- Findings: `{{RUN_DIR}}/domain-config-findings.md`

## Completion

Write `{{RUN_DIR}}/domain-config-done` as the LAST action.
```

---

## Template 3 — Resilience Domain Agent

**Launched by orchestrator in Wave 1. Owns error handling, recovery, and concurrency.**

```
You are Wave-1 Resilience Domain Agent for SDK Functional Audit run {{RUN_DIR}}.

## Your phases

- Phase 3 (Error Handling)
- Phase 10 (Error Quality)
- Phase 13 (Concurrency Safety)

## Execute

For each provider:

1. **Phase 3 — Error Handling**:
   - Simulate provider HTTP errors (400, 401, 429, 500, 503)
   - Network timeouts and connection refused
   - Invalid API keys
   - Verify metering behavior on partial failures
   - Circuit breaker: verify open/half-open/close transitions
   - Retry logic: verify no double-metering

2. **Phase 10 — Error Quality**:
   - Error messages are descriptive (not generic "An error occurred")
   - Errors reference the correct provider name
   - Missing config errors tell the user which env var to set
   - No raw stack traces exposed to callers
   - Circuit breaker state transitions produce clear messages

3. **Phase 13 — Concurrency Safety**:
   - 10 concurrent calls across different providers
   - Verify no cross-request state bleed (AsyncLocalStorage)
   - Metering payloads attributed to correct request
   - Multi-tenant scenario (different API keys concurrently)

## Capture

- Findings: `{{RUN_DIR}}/domain-resilience-findings.md`

## Completion

Write `{{RUN_DIR}}/domain-resilience-done` as the LAST action.
```

---

## Template 4 — Cross-cutting Domain Agent

**Launched by orchestrator in Wave 1. Broadest agent — covers initialization, lifecycle, drift, security, and edge cases.**

```
You are Wave-1 Cross-cutting Domain Agent for SDK Functional Audit run {{RUN_DIR}}.

## Your phases

- Phase 1 (Provider Enumeration)
- Phase 2 (Interception Lifecycle)
- Phase 4 (Provider API Drift)
- Phase 7 (Security Lint)
- Phase 9 (Boundary Values)

## Execute

1. **Phase 1 — Provider Enumeration**:
   - Verify all 8 providers can be imported and initialized
   - Check Initialize()/GetClient() or equivalent for each
   - Verify auto-detection (Azure vs standard OpenAI)
   - Confirm middleware hooks are installed
   - List entry points: @revenium/middleware/openai, /anthropic, etc.

2. **Phase 2 — Interception Lifecycle**:
   - For each provider: import -> initialize -> API call -> verify interception
   - Test both CJS (require) and ESM (import) paths
   - Verify hook installation, request capture, response capture
   - Test disable metering -> verify pass-through
   - Verify no double-wrapping on repeated initialization

3. **Phase 4 — Provider API Drift**:
   - Mock responses with unknown/extra fields
   - Verify SDK doesn't crash on new provider response shapes
   - Test version-specific API differences per provider
   - Verify type coercion doesn't break metering extraction

4. **Phase 7 — Security Lint**:
   - Grep source for secret leak patterns
   - Verify API keys never appear in logs
   - Verify provider keys not in metering payloads
   - Check for hardcoded credentials in source
   - Verify debug mode doesn't expose sensitive fields

5. **Phase 9 — Boundary Values**:
   - Very large prompts (near provider limits)
   - Empty prompts/messages
   - Zero-token responses
   - Maximum concurrent requests
   - Unicode edge cases
   - Numeric precision in token counts

## Capture

- Findings: `{{RUN_DIR}}/domain-crosscutting-findings.md`

## Completion

Write `{{RUN_DIR}}/domain-crosscutting-done` as the LAST action.

## Scope constraints

- DO NOT run Phases 5, 8, 11, 12 (Metering Domain)
- DO NOT run Phase 6 (Config Domain)
- DO NOT run Phases 3, 10, 13 (Resilience Domain)
- DO NOT run Phase 14 (Regression — Wave 3)
```

---

## Template 5 — Regression Library Agent (Wave 3)

**Launched by orchestrator in Wave 3 after Wave 1 + Wave 2 scripts complete.**

```
You are Wave-3 Regression Library Agent for SDK Functional Audit run {{RUN_DIR}}.

## Your job

Execute Phase 14 (Regression Library): iterate the entries in
`{{SDK_DIR}}/.claude/commands/sdk-functional-testing.regression-library.yaml`
and assert every previously-fixed SDK bug still does not manifest. PREFER
reading Wave 1/2 captures over making fresh API calls.

## Read first

1. `{{SDK_DIR}}/.claude/commands/sdk-functional-testing.md` — Phase 14 prose
2. `{{SDK_DIR}}/.claude/commands/sdk-functional-testing.regression-library.yaml`
3. `{{RUN_DIR}}/domain-*-findings.md` (Wave 1 per-domain findings)
4. `{{RUN_DIR}}/xcut-*-findings.md` (Wave 2 cross-cutting findings)

## Execute

- **Pre-flight** — validate the library: required keys present, class
  letters valid (A-M), provider names valid.
- **Per-entry dispatch** — for each entry:
  - Execute the reproduction scenario
  - Assert the fix still holds
  - Report pass/fail/skip/error
- **Summary** — report pass/fail/skip/error per entry with tally.

If the regression library is empty (bootstrap state), report "0 entries —
library is empty, no regressions to check" and PASS.

## Capture

- Findings: `{{RUN_DIR}}/regression-1-findings.md`
- Per-entry trace: `{{RUN_DIR}}/regression/entries/<ticket>.json`

## Completion

Write `{{RUN_DIR}}/regression-1-done`.

## Scope constraints

- Every library entry MUST be accounted for (pass / fail / skip / error).
- Runner errors are DISTINCT from regression failures. Keep them separate.
```

---

## Launch patterns for the orchestrator

**Wave 1 (one message, all 4 domain agents launched in parallel):**

```
Wave 1 launch — one tool-use block with:
  Agent: Metering Domain Agent (run_in_background=true)
  Agent: Config Domain Agent (run_in_background=true)
  Agent: Resilience Domain Agent (run_in_background=true)
  Agent: Cross-cutting Domain Agent (run_in_background=true)

Then:
  Bash: wait-for-agents.sh $RUN_DIR 4 domain 900
  Read: $RUN_DIR/domain-combined-report.md
```

**Wave 2 (orchestrator runs 2 scripts, no agents):**

```
  Bash: security-lint.sh $RUN_DIR
  Bash: provider-drift-check.sh $RUN_DIR
```

**Wave 3:**

```
  Agent: Regression Library Agent (run_in_background=true)
  Bash: wait-for-agents.sh $RUN_DIR 1 regression 600
  Read: $RUN_DIR/regression-combined-report.md
```

## Selecting the agent model

All five agents default to **Sonnet** (subagent_type=`general-purpose`, model omitted). Domain agents are I/O-bound with shallow reasoning. The Regression Library Agent has the most cross-cutting dispatch logic; still Sonnet is sufficient. If a specific domain agent hits reasoning limits, upgrade just that one to Opus via `model: "opus"`.
