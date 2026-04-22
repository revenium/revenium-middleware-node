---
name: sdk-functional-testing
description: "14-phase functional test framework for the Revenium Node.js middleware SDK (@revenium/middleware). Covers provider enumeration, interception lifecycle, error handling, provider API drift, request/response fidelity, config integrity, security lint, streaming validation, boundary values, error quality, metering round-trip, latency overhead, concurrency safety, and regression library. Use when the user asks to test the SDK, validate a provider integration, or check middleware behavior."
---

# SDK Functional Testing — 14-Phase Framework

Authoritative test specification for `@revenium/middleware`, the Revenium Node.js middleware SDK. This framework validates that the SDK correctly intercepts AI provider API calls, meters usage accurately, and remains transparent to the application.

## Target system

- **Package**: `@revenium/middleware` (npm)
- **Source**: `src/` in revenium-middleware-node
- **Providers**: OpenAI, Azure OpenAI, Anthropic, Google GenAI, Google Vertex AI, Perplexity, LiteLLM, fal.ai
- **Test framework**: Jest with ts-jest
- **Node.js**: >= 18.0.0

## Provider entry points

| Provider | Import path | Init pattern |
|---|---|---|
| OpenAI | `@revenium/middleware/openai` | `Initialize()` / `GetClient()` |
| Azure OpenAI | `@revenium/middleware/openai` | `Initialize()` with Azure env vars |
| Anthropic | `@revenium/middleware/anthropic` | Auto-patches on import |
| Google GenAI | `@revenium/middleware/google/genai` | `GoogleGenAIController` |
| Google Vertex | `@revenium/middleware/google/vertex` | `GoogleVertexController` |
| Perplexity | `@revenium/middleware/perplexity` | `Initialize()` / `GetClient()` |
| LiteLLM | `@revenium/middleware/litellm` | HTTP client patching |
| fal.ai | `@revenium/middleware/fal` | `createFalClient()` |

## Environment requirements

Required:
- `REVENIUM_METERING_API_KEY` — Revenium metering API key (hak_...)
- `REVENIUM_METERING_BASE_URL` — Revenium API endpoint (default: https://api.revenium.ai)

Per-provider (at least one needed for live testing):
- `OPENAI_API_KEY` — OpenAI / Azure OpenAI
- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY` — Google AI Studio
- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_LOCATION`
- `PERPLEXITY_API_KEY`
- `LITELLM_PROXY_URL`, `LITELLM_API_KEY`
- `FAL_KEY`

Optional:
- `REVENIUM_DEBUG=true` — verbose logging
- `REVENIUM_PRINT_SUMMARY=human|json|false`

---

# Phase 1: Provider Enumeration

**Catches bug class**: A (Instrumentation Coverage Gaps)

Verify all 8 providers can be imported, initialized, and have their middleware hooks installed.

## 1a — Import verification

For each provider entry point, verify the module resolves without error in both CJS and ESM:

```typescript
// CJS
const openai = require('@revenium/middleware/openai');
expect(openai.Initialize).toBeDefined();
expect(openai.GetClient).toBeDefined();

// ESM
const { Initialize, GetClient } = await import('@revenium/middleware/openai');
expect(Initialize).toBeDefined();
```

Repeat for all 8 provider paths. Assert each exports the documented public API.

## 1b — Initialization verification

For each provider, call the initialization function and verify it completes without throwing:

- OpenAI: `Initialize()` returns void, `GetClient()` returns an OpenAI instance
- Anthropic: importing the module auto-patches `Anthropic` constructor
- Google GenAI: `new GoogleGenAIController({...})` constructs without error
- Google Vertex: `new GoogleVertexController({...})` constructs without error
- Perplexity: `Initialize()` returns void, `GetClient()` returns client
- LiteLLM: module import patches global fetch
- fal.ai: `createFalClient()` returns wrapped client

## 1c — Hook installation verification

After initialization, verify the middleware hooks are active:

- OpenAI/Perplexity: the returned client's methods are wrapped (not the raw SDK methods)
- Anthropic: `Anthropic.prototype.messages.create` is augmented
- Google: controller methods route through the service layer with metering
- LiteLLM: `global.fetch` or `http.request` is patched
- fal.ai: client methods wrap the underlying fal SDK calls

## 1d — Auto-detection

- Set `AZURE_OPENAI_ENDPOINT` and verify OpenAI provider detects Azure mode
- Unset Azure vars and verify standard OpenAI mode
- Reference: `src/openai/provider-detection.ts`

## Expected outcomes

- All 8 providers import and initialize without error
- Each provider exports its documented public API
- Hooks are installed and verifiable
- Azure auto-detection works correctly

---

# Phase 2: Interception Lifecycle

**Catches bug classes**: A (Coverage Gaps), C (Request/Response Fidelity)

Test the full middleware lifecycle for each provider: import, initialize, make API call, verify interception, verify metering payload, verify fire-and-forget dispatch.

## 2a — Full lifecycle (per provider)

For each provider:

1. Import and initialize the provider
2. Mock the provider's HTTP layer to return a known response
3. Make an API call through the SDK
4. Assert the middleware intercepted the call (metering payload was built)
5. Assert the response was passed through unmodified to the caller
6. Assert fire-and-forget dispatch was triggered (fetch to REVENIUM_METERING_BASE_URL)

## 2b — CJS vs ESM parity

Run the lifecycle test in both module formats. The SDK ships dual CJS/ESM builds — verify both paths produce identical metering behavior.

## 2c — Disable metering

Set config to disable metering (e.g., unset `REVENIUM_METERING_API_KEY`). Verify:
- Provider calls still work (pass-through)
- No metering payload is built
- No fetch to Revenium API
- No errors thrown

## 2d — Double initialization guard

Call `Initialize()` twice. Verify:
- No double-wrapping of provider methods
- No duplicate metering payloads per call
- No memory leaks from duplicate listeners

## Expected outcomes

- Every provider's API calls are intercepted and metered
- CJS and ESM produce identical behavior
- Disabling metering results in clean pass-through
- Double initialization is safe (idempotent)

---

# Phase 3: Error Handling

**Catches bug classes**: E (Error Handling Issues), C (Fidelity Breakages)

Test error propagation, circuit breaker behavior, and retry logic.

## 3a — Provider HTTP errors

For each provider, simulate these HTTP responses and verify the SDK propagates them correctly to the caller:

| Status | Scenario | Expected SDK behavior |
|---|---|---|
| 400 | Bad request | Error propagated, metering still fires with error metadata |
| 401 | Invalid API key | Error propagated, metering fires |
| 429 | Rate limited | Error propagated, retry-after header preserved |
| 500 | Server error | Error propagated, metering fires |
| 503 | Service unavailable | Error propagated |

For each: assert the error shape (status code, message, headers) matches what the raw provider SDK would return.

## 3b — Network errors

Simulate:
- Connection timeout
- DNS resolution failure
- Connection refused
- Socket hang up mid-response

Verify: errors propagate to caller, no unhandled promise rejections, metering attempts gracefully (fire-and-forget should not throw).

## 3c — Circuit breaker

Reference: `src/_core/resilience/circuit-breaker.ts`

Test the state machine:
1. Closed (normal) -> make calls, verify metering works
2. Trigger threshold failures -> verify circuit opens
3. Open -> verify metering calls are skipped (no fetch), provider calls still work
4. Wait for half-open interval -> verify next call triggers metering attempt
5. Success -> verify circuit closes

Assert: circuit breaker affects ONLY metering, never blocks provider API calls.

## 3d — Retry and double-metering

If the SDK retries a failed metering call:
- Verify the same usage is not metered twice
- Verify retry count is bounded
- Verify retry backoff follows configuration

## 3e — Streaming interruption

For streaming providers (OpenAI, Anthropic, Google, Perplexity, LiteLLM):
- Start a streaming call
- Simulate interruption mid-stream (abort controller, connection drop)
- Verify: partial usage is still metered, no unhandled errors

## Expected outcomes

- All provider errors propagate transparently
- Network errors don't cause unhandled rejections
- Circuit breaker protects metering without blocking provider calls
- No double-metering on retries
- Streaming interruptions are handled gracefully

---

# Phase 4: Provider API Drift

**Catches bug class**: F (Provider Compatibility/Drift)

Test SDK resilience to changes in provider API responses.

## 4a — Unknown response fields

For each provider, mock a response that includes extra fields not in the current SDK's type definitions. Verify:
- SDK doesn't crash
- Metering still extracts the fields it needs (model, tokens, etc.)
- Extra fields are passed through to the caller

## 4b — Missing optional fields

Mock responses where optional fields are absent (e.g., `usage` field missing from OpenAI response). Verify:
- SDK doesn't crash
- Metering gracefully handles missing usage data (logs warning, doesn't throw)
- Response is still passed through

## 4c — Type coercion

Mock responses where field types differ from expected (e.g., `usage.total_tokens` as string instead of number). Verify:
- SDK handles coercion gracefully
- Metering payload has correct numeric types

## 4d — Version-specific behavior

For providers with known API versions:
- OpenAI: test with chat completions v1 response shape
- Anthropic: test with Messages API response shape
- Azure: test with different API version response shapes
- Google: test with generateContent response shape

## Expected outcomes

- SDK survives unknown fields without crashing
- Missing optional fields produce warnings, not errors
- Type coercion is handled correctly
- Version-specific response shapes are all supported

---

# Phase 5: Request/Response Fidelity

**Catches bug class**: C (Request/Response Fidelity Breakages)

Verify the SDK is transparent — it must not alter the observable behavior of provider API calls beyond metering.

## 5a — Response body fidelity

For each provider, compare:
1. Raw provider SDK call result (without middleware)
2. SDK-wrapped call result (with middleware)

Assert: identical response bodies (same fields, same values, same types).

## 5b — Status code fidelity

Verify HTTP status codes pass through unmodified. Test both success (200) and error (4xx, 5xx) codes.

## 5c — Header fidelity

Verify response headers are preserved. The SDK should not strip, add, or modify headers visible to the caller.

## 5d — Streaming chunk fidelity

For streaming providers:
- Mock a stream with known chunk sequence
- Verify chunks arrive in the same order, with the same content
- Verify no chunks are dropped, duplicated, or merged
- Verify chunk timing is not significantly altered

## 5e — Error fidelity

When the provider returns an error:
- Error type/class must match the raw SDK's error type
- Error message must be identical
- Error metadata (status, headers, request_id) must be preserved

## Expected outcomes

- Response bodies identical with and without middleware
- Status codes pass through unmodified
- Headers preserved
- Streaming chunks arrive in order, unaltered
- Error shapes match raw SDK behavior

---

# Phase 6: Config Integrity

**Catches bug class**: D (Configuration Misbehavior)

Test all configuration loading paths and verify correct behavior.

## 6a — Config loading paths

Test three config sources for `REVENIUM_METERING_API_KEY` and `REVENIUM_METERING_BASE_URL`:

1. Environment variables (process.env)
2. Programmatic config (passed to Initialize/constructor)
3. .env file (via dotenv)

## 6b — Precedence

Set conflicting values across sources. Assert precedence: programmatic > env var > .env file > default.

## 6c — Provider-specific config

For each provider, test that provider-specific config is loaded correctly:

- OpenAI: `OPENAI_API_KEY`, `OPENAI_BASE_URL`
- Azure: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`
- Anthropic: `ANTHROPIC_API_KEY`
- Google GenAI: `GOOGLE_API_KEY`
- Google Vertex: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_LOCATION`
- Perplexity: `PERPLEXITY_API_KEY`
- LiteLLM: `LITELLM_PROXY_URL`, `LITELLM_API_KEY`
- fal.ai: `FAL_KEY`

## 6d — Missing config behavior

Unset required config and verify:
- Clear error message telling the user which variable to set
- No silent failures (metering doesn't just silently stop)
- Provider calls still work (metering failure should not block the app)

## 6e — Invalid config

Set invalid values and verify behavior:
- Empty string for API key
- Malformed URL for base URL
- Non-numeric values for numeric config
- Verify: clear errors, no crashes

## 6f — Config validation

Reference: `src/_core/config/validator.ts`

Run the config validator with various invalid inputs. Verify it catches:
- Missing required fields
- Invalid URL formats
- Invalid API key formats (if pattern-checked)

## Expected outcomes

- All config paths work correctly
- Precedence is respected
- Missing config produces clear errors
- Invalid config is caught by validation
- Config issues never block provider API calls

---

# Phase 7: Security Lint

**Catches bug class**: H (Security/Privacy Violations)

Static and dynamic checks for secret leakage.

## 7a — Source code scan

Grep `src/` for patterns that could leak secrets:

Patterns to flag:
- `console.log` or `console.debug` containing config/key variable names
- String interpolation of API key variables in log messages
- `JSON.stringify` of config objects without redaction

Patterns to allow:
- Masked/redacted logging (e.g., `key.slice(0, 4) + '***'`)
- Debug logging behind `REVENIUM_DEBUG` flag (acceptable if keys are not exposed)

## 7b — Metering payload audit

Inspect the metering payload builder (`src/_core/metering/payload-builder.ts`). Verify:
- No provider API keys in the payload
- No raw request/response bodies unless `REVENIUM_CAPTURE_PROMPTS` is explicitly enabled
- `REVENIUM_METERING_API_KEY` itself is not included in payload body (only in auth header)

## 7c — Debug mode audit

Enable `REVENIUM_DEBUG=true`. Make a metered call. Capture all console output. Verify:
- No API keys (provider or Revenium) in any log line
- No full request/response bodies in debug output (summaries OK)
- No credentials in error stack traces

## 7d — Hardcoded credential scan

Grep `src/` and `tests/` for patterns matching known API key formats:
- `sk-[a-zA-Z0-9]{20,}` (OpenAI)
- `hak_[a-zA-Z0-9]+` (Revenium)
- `sk-ant-[a-zA-Z0-9]+` (Anthropic)
- `pplx-[a-zA-Z0-9]+` (Perplexity)
- `AIza[a-zA-Z0-9]+` (Google)

Any matches that are not clearly placeholder/example values are findings.

## Expected outcomes

- No API keys in console output at any log level
- Metering payloads contain no provider credentials
- Debug mode doesn't expose sensitive data
- No hardcoded real credentials in source

---

# Phase 8: Streaming Validation

**Catches bug classes**: B (Metering Accuracy), C (Fidelity Breakages)

Test SSE/streaming interception across providers that support it.

## Streaming-capable providers

| Provider | Streaming support | Stream shape |
|---|---|---|
| OpenAI | Yes | SSE chunks with `choices[].delta` |
| Azure OpenAI | Yes | SSE chunks with `choices[].delta` |
| Anthropic | Yes | SSE with `content_block_delta` |
| Google GenAI | Yes | Iterable `generateContentStream` |
| Google Vertex | Yes | Iterable `generateContentStream` |
| Perplexity | Yes | SSE chunks (OpenAI-compatible) |
| LiteLLM | Yes | SSE via proxy |
| fal.ai | No (n/a) | Media generation, not streaming text |

## 8a — Token count accuracy

For each streaming-capable provider:
1. Mock a stream with known token counts per chunk
2. Consume the stream through the SDK
3. Capture the metering payload
4. Assert `total_tokens` matches the sum of all chunks

## 8b — Metering timing

Verify metering fires AFTER stream completion:
1. Start consuming a stream
2. Verify no metering call is made during streaming
3. Complete the stream
4. Verify metering fires within 1 second of completion

## 8c — Stream interruption

1. Start consuming a stream
2. Abort after 3 chunks (via AbortController or manual close)
3. Verify partial usage is metered (tokens from consumed chunks)
4. Verify no unhandled errors or rejected promises

## 8d — Chunk integrity

1. Mock a stream with known chunk content
2. Consume through SDK
3. Assert every chunk arrived in order, with correct content
4. Assert no chunks were dropped, merged, or duplicated

## 8e — for-await-of vs callback

For providers that support both patterns:
- Test streaming with `for await (const chunk of stream)`
- Test streaming with event listeners / callbacks
- Verify identical metering behavior in both patterns

## Expected outcomes

- Token counts are accurate for all streaming providers
- Metering fires once, after stream completion
- Stream interruption meters partial usage
- Chunks are not altered by the middleware
- Both consumption patterns produce identical metering

---

# Phase 9: Boundary Values

**Catches bug classes**: B (Metering Accuracy), G (Performance/Resource Overhead)

Test edge cases and extreme inputs.

## 9a — Large payloads

For each provider:
- Send a prompt near the provider's max token limit (e.g., 128K tokens for GPT-4)
- Verify: no OOM, no timeout from metering overhead, correct token count

## 9b — Empty/minimal inputs

- Empty messages array
- Single empty string message
- Zero-token response (if provider allows)
- Verify: no crashes, metering handles gracefully

## 9c — Unicode edge cases

- Emoji-heavy prompts (multi-byte characters)
- RTL text (Arabic, Hebrew)
- CJK characters
- Mixed scripts
- Verify: token counts are correct (not byte counts), no encoding errors

## 9d — Numeric precision

- Verify token counts are integers (no floating-point artifacts)
- Verify cost calculations (if any) maintain precision
- Test with very large token counts (100K+)

## 9e — Concurrent load

- Fire 10 concurrent API calls through the SDK
- Verify: all 10 metering payloads are sent, no payloads lost, no cross-contamination

## 9f — Rapid sequential calls

- Make 100 calls in a tight loop
- Verify: all metered, no memory growth beyond O(n), circuit breaker doesn't false-trigger

## Expected outcomes

- Large payloads don't cause OOM or excessive overhead
- Empty inputs are handled gracefully
- Unicode is processed correctly
- Numeric values are precise integers
- Concurrent and rapid calls don't cause data loss

---

# Phase 10: Error Quality

**Catches bug class**: K (Observability Defects)

Validate that errors are descriptive, actionable, and correct.

## 10a — Missing config errors

For each required env var, unset it and trigger the code path that needs it. Verify the error message:
- Names the missing variable explicitly
- Suggests how to fix it (e.g., "Set OPENAI_API_KEY environment variable")
- Does NOT include a raw stack trace as the primary message

## 10b — Provider error attribution

When a provider returns an error, verify the SDK's error output:
- Identifies the correct provider name
- Preserves the provider's error message
- Includes the HTTP status code
- Does not confuse one provider's error format with another's

## 10c — Circuit breaker messaging

When the circuit breaker opens:
- Log message clearly states "circuit breaker open" (or equivalent)
- Includes the failure count that triggered it
- When half-open: log message states the probe attempt

## 10d — Configuration validation errors

When invalid config is provided:
- Error message identifies which field is invalid
- Includes the invalid value (or sanitized version)
- Suggests the expected format

## Expected outcomes

- Missing config errors name the variable and suggest a fix
- Provider errors are correctly attributed
- Circuit breaker state changes are logged clearly
- Config validation errors are specific and actionable

---

# Phase 11: Metering Round-trip

**Catches bug classes**: B (Metering Accuracy), L (Regression Reintroductions)

End-to-end verification that metering data is correct and delivered.

## 11a — Payload shape validation

Make an API call through the SDK. Capture the metering payload (mock the fetch to Revenium API). Validate against the `ReveniumPayload` type:

Required fields:
- `model` — correct model name from provider response
- `provider` — correct provider identifier
- `inputTokens` / `outputTokens` / `totalTokens` — numeric, non-negative
- `timestamp` — ISO 8601 format
- `duration` — positive number (milliseconds)
- `statusCode` — HTTP status from provider

## 11b — Per-provider payload correctness

For each provider, verify provider-specific payload fields:
- OpenAI: `model` matches `response.model`, token counts match `response.usage`
- Anthropic: `model` matches, input/output tokens from `response.usage`
- Google: model and token extraction from GenerateContentResponse
- Perplexity: OpenAI-compatible payload
- LiteLLM: model and usage from proxy response
- fal.ai: media-type-specific fields (image dimensions, duration, etc.)

## 11c — Metadata fields

Verify optional metadata is included when configured:
- `REVENIUM_ENVIRONMENT` -> `environment` field
- `REVENIUM_REGION` -> `region` field
- `REVENIUM_TRACE_TYPE` -> `traceType` field
- `REVENIUM_TRANSACTION_NAME` -> `transactionName` field
- `REVENIUM_TEAM_ID` -> `teamId` field

## 11d — Delivery verification

If `REVENIUM_METERING_BASE_URL` points to a test endpoint:
1. Make an API call
2. Wait for fire-and-forget to complete
3. Query the test endpoint for the received payload
4. Assert payload matches what was built

For mock testing: intercept `global.fetch` and verify the POST to the metering URL.

## Expected outcomes

- Payload shape matches ReveniumPayload type
- Per-provider fields are correctly extracted
- Metadata fields are included when configured
- Payload is delivered to the metering endpoint

---

# Phase 12: Latency Overhead

**Catches bug class**: G (Performance/Resource Overhead)

Measure the performance impact of the middleware.

## 12a — Single-call overhead

For each provider:
1. Mock the provider to return instantly (0ms simulated latency)
2. Measure raw SDK call time (no middleware)
3. Measure wrapped SDK call time (with middleware)
4. Assert: overhead < 5ms per call (middleware should add negligible time)

## 12b — Fire-and-forget verification

Verify the metering POST does not block the response:
1. Mock the Revenium API to be slow (2000ms response time)
2. Make an API call through the SDK
3. Assert: response returned to caller in < 50ms (not waiting for metering)

## 12c — Concurrent overhead

1. Fire 10 concurrent calls with middleware
2. Fire 10 concurrent calls without middleware
3. Assert: total time difference < 10% (middleware doesn't serialize concurrent calls)

## 12d — Memory overhead

1. Make 1000 calls in sequence
2. Measure heap usage before and after
3. Assert: no significant memory growth (no leaked references)
4. Verify: GC can collect all middleware-internal objects

## Expected outcomes

- Per-call overhead < 5ms
- Fire-and-forget doesn't block responses
- Concurrent performance not degraded
- No memory leaks

---

# Phase 13: Concurrency Safety

**Catches bug class**: I (Concurrency/Lifecycle Bugs)

Verify isolation between concurrent requests.

## 13a — AsyncLocalStorage isolation

Reference: `src/_core/tool-metering/tool-context.ts`

1. Start two concurrent API calls with different metadata (different subscriber IDs, different trace IDs)
2. Verify each metering payload contains its own metadata, not the other's
3. Repeat with 10 concurrent calls

## 13b — Multi-provider concurrent calls

1. Make concurrent calls to different providers (e.g., OpenAI + Anthropic + Google simultaneously)
2. Verify each metering payload has the correct provider name and model
3. Verify no cross-contamination of provider-specific fields

## 13c — Multi-tenant isolation

1. Simulate two tenants with different `REVENIUM_METERING_API_KEY` values
2. Make concurrent calls from both tenants
3. Verify metering for each call uses the correct API key in the auth header

## 13d — Race condition probing

1. Initialize and make a call simultaneously (race the init with the first call)
2. Verify: either the call is metered correctly or cleanly skipped (not a crash)
3. Test rapid enable/disable toggling during active calls

## Expected outcomes

- AsyncLocalStorage correctly isolates concurrent requests
- Multi-provider calls don't cross-contaminate
- Multi-tenant metering uses correct credentials
- Race conditions don't cause crashes

---

# Phase 14: Regression Library

**Catches bug class**: L (Regression Reintroductions)

Replay previously-fixed bugs to ensure they haven't returned.

## 14a — Pre-flight validation

Load `sdk-functional-testing.regression-library.yaml`. Validate:
- Required keys present on every entry (ticket, title, class, providers, domain, reproduction)
- Class letters are valid (A-M)
- Provider names are valid
- Assertion types are recognized

If the library is empty (bootstrap state), report PASS with "0 entries."

## 14b — Per-entry execution

For each entry in the library:

1. Read the `reproduction` block
2. Set up the test scenario (provider, config, mocks)
3. Execute the action
4. Run the assertion
5. Report: PASS (fix holds), FAIL (regression), SKIP (can't reproduce), ERROR (test infrastructure issue)

## 14c — Assertion type dispatch

Supported assertion types:

| Type | What it checks |
|---|---|
| `metering-accuracy` | Token counts, model name, provider attribution |
| `response-fidelity` | Response body, status code, headers match expected |
| `config-validation` | Config loading, precedence, error messages |
| `error-propagation` | Error shape, type, message preservation |
| `security-check` | No secrets in logs/payloads |
| `lifecycle-check` | Init, teardown, hook installation |
| `performance-bound` | Latency, memory within bounds |
| `schema-validation` | Payload shape matches type definitions |
| `provider-detection` | Correct provider identified |
| `streaming-integrity` | Chunk order, count, timing |
| `concurrency-safety` | No cross-contamination between concurrent calls |

## 14d — Summary

Report:
- Total entries
- Passed / Failed / Skipped / Errors
- Per-class breakdown (how many regressions per bug class)

## Expected outcomes

- All previously-fixed bugs remain fixed
- Any regression is flagged with the original ticket reference
- Empty library produces a clean PASS

---

# Report structure

When run standalone (not via the orchestrator), produce a report with:

1. **Header** — date, SDK version, Node.js version, providers tested
2. **Summary** — verdict + severity counts
3. **Per-phase findings** — organized by phase number
4. **Coverage gaps** — phases skipped and why
5. **Recommendations** — next steps based on findings

Verdict rules:
- >= 1 critical finding: **FAIL**
- >= 1 major finding (0 critical): **PASS WITH ISSUES**
- 0 critical, 0 major: **PASS**

---

# Bug class cross-reference

| Phase | Primary bug classes caught |
|---|---|
| 1 (Provider Enumeration) | A |
| 2 (Interception Lifecycle) | A, C |
| 3 (Error Handling) | E, C |
| 4 (Provider API Drift) | F |
| 5 (Request/Response Fidelity) | C |
| 6 (Config Integrity) | D |
| 7 (Security Lint) | H |
| 8 (Streaming Validation) | B, C |
| 9 (Boundary Values) | B, G |
| 10 (Error Quality) | K |
| 11 (Metering Round-trip) | B, L |
| 12 (Latency Overhead) | G |
| 13 (Concurrency Safety) | I |
| 14 (Regression Library) | L |
