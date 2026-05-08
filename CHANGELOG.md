# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.5] - 2026-05-08

### Fixed

- Circuit breaker isolation: metering and enforcement now use independent breaker instances, preventing enforcement failures from tripping the metering circuit and vice versa

### Changed

- README: added Cost Controls / Enforcement section with configuration and usage documentation

## [1.1.4] - 2026-05-04

### Added

- 13 fields to shared `UsageMetadata` interface (`retryNumber`, `environment`, `region`, `parentTransactionId`, `transactionName`, `traceType`, `traceName`, `operationSubtype`, `errorReason`, `credentialAlias`, `mediationLatency`, `systemFingerprint`, `temperature`) for per-request configuration across all providers

### Fixed

- Precedence bug in `payload-builder.ts` where env vars overwrote user-provided values (now: user-set > env var > undefined)

### Changed

- De-duplicated `GoogleUsageMetadata`, `FalUsageMetadata`, `LiteLLMUsageMetadata` to extend shared `UsageMetadata` interface instead of redeclaring fields

## [1.1.3] - 2026-04-27

### Added

- Support for new `rev_` API key prefix (covers `rev_mk_`, `rev_sk_`, and future key types)
- Client-side cost enforcement engine with polling, rule evaluation, and circuit breaker integration
- `CostLimitExceeded` error class for enforcement rule violations
- E2E smoke test script

### Changed

- API key validator now accepts both `hak_` (legacy) and `rev_` (new) prefixes
- Config loader reads `REVENIUM_ENFORCEMENT_BASE_URL` environment variable
- `ReveniumConfig` type extended with `reveniumTeamId` and `reveniumEnforcementBaseUrl` fields

## [1.1.2] - 2026-04-02

### Changed

- Renamed package repository from `revenium-middleware-node` to `revenium-node-sdk`

### Added

- Usage examples for OpenAI, Anthropic, Google GenAI, Google Vertex AI, Perplexity and Azure OpenAI covering basic, streaming, metadata, prompt capture and embeddings

### Fixed

- Anthropic streaming runtime error in embed example
- `REVENIUM_TEAM_ID` environment variable fallback in `buildJobRequest`
- Prettier formatting in `normalizePagedResponse`

## [1.1.0] - 2026-03-19

### Added

- Jobs API support with `JobContext` using `AsyncLocalStorage` for agentic workflow tracking
- Environment variable fallbacks for Jobs API configuration
- Graceful 409 conflict handling in Jobs API responses
- fal.ai middleware wrapper with multi-modal metering support (image, video, audio)
- HATEOAS-driven Jobs API endpoint discovery

### Fixed

- Google Vertex image resolution and quality fields in metering payload
- VIDEO endpoint routing and circuit breaker wiring
- Canonical model name from API response for accurate pricing resolution
- LiteLLM `ReveniumPayload` type safety enforcement
- API key error messages for clearer diagnostics
- Internal package reference in Perplexity client error message

## [1.0.0] - 2025-02-24

### Added

- Unified middleware combining OpenAI, Anthropic, Google (GenAI + Vertex AI), Perplexity, and LiteLLM providers
- Sub-path imports for tree-shakeable provider access (`@revenium/middleware/openai`, `/anthropic`, `/google/genai`, `/google/vertex`, `/perplexity`, `/litellm`, `/tools`)
- Go-aligned API pattern with `Initialize()` / `GetClient()` for OpenAI and Perplexity providers
- Auto-initialization on import for Anthropic provider with `patchAnthropic()` / `unpatchAnthropic()` control
- Google GenAI and Vertex AI support via controller/service pattern
- LiteLLM proxy support with HTTP client patching, `enable()` / `disable()` lifecycle
- Shared core infrastructure (`_core`) with circuit breaker, config manager, API client, retry logic, and error handling
- Tool metering system with `meterTool()`, `reportToolCall()`, and async-safe context management via `AsyncLocalStorage`
- Streaming support for all providers with base wrapper abstraction
- Fire-and-forget metering that never blocks application flow
- ESM + CJS dual output with TypeScript type definitions
- Metadata and trace visualization fields for distributed tracing and analytics
- Terminal summary output with human-readable and JSON formats
- Prompt capture with automatic PII sanitization
- Azure OpenAI automatic detection and configuration
- 130 unit and integration tests

[1.1.5]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.1.5
[1.1.4]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.1.4
[1.1.3]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.1.3
[1.1.2]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.1.2
[1.1.1]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.1.1
[1.1.0]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.1.0
[1.0.0]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.0.0
