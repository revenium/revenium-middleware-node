---
name: sdk-functional-audit
description: "Waved-orchestrator audit of the Revenium Node.js middleware SDK. Runs the 12-phase sdk-functional-testing suite via 4 parallel domain subagents + 2 deterministic cross-cutting scripts + 1 regression agent, all coordinating via file-based handoff. Use when the user asks for a full SDK audit, a regression run, or comprehensive 'test everything'. Also trigger on 'audit the SDK', 'full audit', 'sdk orchestrator'."
---

# SDK Functional Audit — Waved Orchestrator

Thin orchestrator that runs the 12-phase `sdk-functional-testing` suite at full scope without exhausting a single agent's context. Companion to `.claude/commands/sdk-functional-testing.md`, which remains the authoritative per-phase reference and standalone-runnable for debugging.

**You are an ORCHESTRATOR, not a tester.** Your job is to route, launch, synchronize, and synthesize. You never read response bodies, never form opinions about code quality, never analyze findings. Every finding comes from a subagent (or a deterministic Wave 2 script) and lands on disk.

## The pattern

Modelled after the MCP functional audit orchestrator. Invariants:
- **Parallel launch** — every wave's subagents launched in ONE message with `run_in_background: true`
- **File-based handoff** — subagents and scripts read/write under `$RUN_DIR/`; you never pass content through conversation
- **`wait-for-agents.sh`** is the ONLY synchronization primitive for subagents
- **NEVER call TaskOutput** — it returns 10-40K tokens per agent. Use `-done` markers + `combined-report.md` instead
- **Orchestrator final context <= 50K tokens** regardless of audit size

## Wave structure

| Wave | Units | Purpose |
|---|---|---|
| 0 | 1 script | Pre-flight: env + RUN_DIR + provider detection + dependency check |
| 1 | **4 domain subagents** (parallel) | Per-provider phases across all 8 providers, grouped by domain |
| 2 | **2 deterministic scripts** (no subagents) | Security lint, provider drift check |
| 3 | 1 subagent | Regression library |
| 4 | Orchestrator | Synth + report |

Totals: **5 subagents + 3 scripts.**

## Arguments

```
/sdk-functional-audit                              # Full Audit (default)
/sdk-functional-audit --smoke                      # Wave 0 only, no subagents
/sdk-functional-audit --provider openai            # Targeted: one domain agent, restricted to this provider
/sdk-functional-audit --phase 8 --provider openai  # Spot-check: one domain agent, one phase, one provider
/sdk-functional-audit --regression                 # Wave 0 + Wave 3 + Wave 4
/sdk-functional-audit --sdk-dir /path/to/repo      # Override SDK_DIR (defaults to cwd)
/sdk-functional-audit --env-file /path/to/.env     # Override credentials source
```

## Step 0 — Parse args and tier-route

Parse the skill arguments. Set:
```
MODE="full"               # full | smoke | targeted | spot-check | regression
PROVIDER_FILTER=""        # set when --provider is present (comma-sep allowed)
PHASE_FILTER=""           # set when --phase is present
SDK_DIR="${SDK_DIR_ARG:-$(pwd)}"
ENV_FILE="${ENV_FILE_ARG:-}"
```

Tier routing:

| Mode | Waves | Subagents | Scripts |
|------|-------|-----------|---------|
| `smoke` | 0 | 0 | 1 (Wave 0 only) |
| `targeted` (provider, no phase) | 0, 1 (relevant domains), 4 | 1-4 | 1 |
| `spot-check` (provider + phase) | 0, 1 (one domain, one phase), 4 | 1 | 1 |
| `regression` | 0, 3, 4 | 1 | 1 |
| `full` (default) | 0, 1, 2, 3, 4 | 5 | 3 |

## Step 1 — Wave 0: pre-flight

```bash
SCRIPTS="$SDK_DIR/.claude/commands/sdk-functional-audit/scripts"
RUN_DIR=$("$SCRIPTS/sdk-setup.sh" "$SDK_DIR" "$ENV_FILE")
```

After Wave 0, `$RUN_DIR/setup/` contains env.sh, providers.json, node-version.txt.

**If `MODE=smoke`, stop here and report Wave 0 results.**

## Step 2 — Wave 1: 4 domain subagents in parallel

**Launch all 4 domain agents in ONE message.** Do NOT launch sequentially. Use the templates in `{{SDK_DIR}}/.claude/commands/sdk-functional-audit/AGENTS.md`.

Domain assignments:

| Domain | Phases | Focus |
|---|---|---|
| Metering | 5, 8, 11, 12 | Request/Response Fidelity, Streaming Validation, Metering Round-trip, Latency Overhead |
| Config | 6 | Config Integrity across all providers |
| Resilience | 3, 10, 13 | Error Handling, Error Quality, Concurrency Safety |
| Cross-cutting | 1, 2, 4, 7, 9 | Provider Enumeration, Interception Lifecycle, Provider API Drift, Security Lint, Boundary Values |

Each domain agent is parameterized with `DOMAIN`, `RUN_DIR`, `SDK_DIR`, and optionally `PROVIDER_FILTER` / `PHASE_FILTER`.

**For `full` mode**, launch all 4. **For `targeted` mode**, launch only the domains that own the phases relevant to the provider filter.

**After launching, wait:**
```bash
if [ "$MODE" = "full" ]; then
    EXPECTED=4
else
    EXPECTED=1
fi
"$SCRIPTS/wait-for-agents.sh" "$RUN_DIR" "$EXPECTED" "domain" 900
```

Read ONLY `$RUN_DIR/domain-combined-report.md`.

**If `MODE=targeted` or `MODE=spot-check`, skip to Step 5 (Wave 4).**

## Step 3 — Wave 2: 2 deterministic scripts (NO subagents)

```bash
"$SCRIPTS/security-lint.sh" "$RUN_DIR"
"$SCRIPTS/provider-drift-check.sh" "$RUN_DIR"
```

Each writes `$RUN_DIR/xcut-<name>-findings.md` + `$RUN_DIR/xcut-<name>-done` synchronously.

## Step 4 — Wave 3: regression library runner

**Launch ONE agent** via Template 5 in AGENTS.md.

```bash
"$SCRIPTS/wait-for-agents.sh" "$RUN_DIR" 1 "regression" 600
```

Read `$RUN_DIR/regression-combined-report.md`.

## Step 5 — Wave 4: synthesis

```bash
"$SCRIPTS/synthesize-audit.sh" "$RUN_DIR"
```

`synthesize-audit.sh`:
- Reads domain-combined-report.md, xcut-*-findings.md, regression-combined-report.md
- Tallies severity counts and computes verdict
- Writes final report to `$SDK_DIR/docs/sdk-audit-$AUDIT_DATE.md`

**Output the final report path and verdict to the user.** Do NOT paste report contents.

## Failure handling

- **Wave 0 fails (missing Node.js / no deps / bad env):** Stop, report the error.
- **`wait-for-agents.sh` returns 1 (partial completion):** Partial combined-report still written. Proceed — synth flags missing sections.
- **Wave 2 script fails:** Synth detects missing xcut outputs and notes them as gaps.

## Self-check before launching subagents

- [ ] I have NOT read test files or source code in full
- [ ] I have NOT read `.claude/commands/sdk-functional-testing.md`
- [ ] I am about to launch ALL Wave 1 agents for this mode in ONE tool call
- [ ] Each Task uses `run_in_background: true`
- [ ] Each agent's prompt comes from AGENTS.md parameterized for its domain
- [ ] Wave 2 is scripts, not Task calls

If you are tempted to analyze code or form an opinion before Wave 1 launches, STOP. You are doing it wrong.

## Notes

- `.claude/commands/sdk-functional-testing.md` is unchanged by the orchestrator — it remains the authoritative phase documentation.
- All artifacts live under `/tmp/_sdk_audit/<run-id>/`. The synth copies the final report to `$SDK_DIR/docs/`.
- Agent prompts are in `sdk-functional-audit/AGENTS.md`.
- Findings format is in `sdk-functional-audit/OUTPUT.md`.
