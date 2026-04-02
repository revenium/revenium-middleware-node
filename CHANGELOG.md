# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-04-02

### Changed

- Renamed package repository from `revenium-middleware-node` to `revenium-node-sdk`
- Added examples directory replicating Python SDK structure

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

[1.1.1]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.1.1
[1.1.0]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.1.0
[1.0.0]: https://github.com/revenium/revenium-node-sdk/releases/tag/v1.0.0
