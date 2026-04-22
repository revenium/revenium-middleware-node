# Findings format — SDK Functional Audit

This document defines the findings format every subagent must emit in its `findings.md`. The orchestrator's `synthesize-audit.sh` script parses these findings to tally severities, compute the verdict, and assemble the final audit report. Subagents must follow this format exactly — deviations will produce silently-dropped findings in the synthesis step.

## The per-finding block

Every finding is a markdown block with exactly these lines, in this order:

```markdown
### FINDING: <short title, one line, <80 chars>
- PHASE: <phase number or name — e.g. 3a, 8b, regression:NODE-001>
- PROVIDER: <provider name or cross-cutting scope — e.g. openai, azure, multi-provider>
- SEVERITY: critical | major | minor | info
- CERTAINTY: definite | probable | possible
- CLASS: <bug class letter A-M or "process">

<one or two paragraphs describing the finding, what was observed, and what
the expected behavior was. Include the exact test setup + observed output
when possible — reviewers need the reproduction detail to triage.>
```

### Required fields

- `PHASE` — which skill phase generated the finding. Use `<phase><subphase>` format (e.g. `3a`, `8b`, `12c`) when applicable. For regression library entries, use `regression:<ticket-id>` (e.g. `regression:NODE-001`).
- `PROVIDER` — the affected provider, or `multi-provider` / `cross-cutting` for Wave 2 findings that aren't provider-specific.
- `SEVERITY` — exactly one of these four lowercase values:
  - `critical` — data corruption, credential/secret leak in plaintext, metering data sent to wrong tenant, or any failure mode where the SDK cannot be safely used as-is.
  - `major` — metering silently fails, usage data is incorrect, provider semantics altered, API contract violation, circuit breaker stuck, open bug regression.
  - `minor` — UX/formatting issue, non-critical documentation gap, cosmetic inconsistency, debug output quality.
  - `info` — observation that doesn't meet the bar for action but is worth noting for future triage.
- `CERTAINTY` — exactly one of:
  - `definite` — reproduced directly in this run; the finding is an observed fact.
  - `probable` — strong evidence (e.g. code analysis, type mismatch) but the agent didn't or couldn't run the full reproduction. Downgrade to this when you inferred rather than observed.
  - `possible` — weak signal (e.g. a single suspicious log line); flag for human triage.
- `CLASS` — bug class letter from `.claude/commands/sdk-functional-testing.bug-classes.yaml` (A-M), or `process` for non-bug process findings.

### Optional fields

- `STATUS` (optional): one of `live` (default if omitted) or `retracted`. A retracted finding is one that was filed earlier in the run but later determined to be a false positive. Retracted findings MUST include a `**Retraction note:**` block explaining why. The synthesizer discounts retracted findings from severity tallies.

### Body

After the metadata lines, a blank line, then free-form markdown. Include:
- Test setup that reproduces the finding (provider, config, call shape)
- Observed output showing the problem (truncate large outputs to the relevant fragment)
- Expected behavior per the phase contract
- Suggested ticket title if SEVERITY is critical/major

### Severity tally rules (for the synth script)

`synthesize-audit.sh` counts findings per severity by scanning each finding block. Blocks that contain `- STATUS: retracted` are excluded from all severity counts. Verdict rules:

| Critical | Major | Verdict |
|---|---|---|
| >= 1 | any | FAIL |
| 0 | >= 1 | PASS WITH ISSUES |
| 0 | 0 | PASS |

Minor and info counts do NOT affect the verdict.

## Structure of a subagent's findings.md

```markdown
# Findings — <agent type> — <domain or cross-cutting scope>

**Run:** <RUN_DIR>
**Agent:** <agent id — e.g. `domain:metering`, `xcut:security-lint`>
**Phases executed:** <list of phase numbers>
**Tests run:** <integer>

## Summary

<one paragraph: what the agent tested, how many findings, high-level verdict>

## Findings

<zero or more finding blocks, format above>

## Coverage gaps

<any phase/probe the agent skipped and why>
```

## Anti-patterns (do not do these)

- **Don't put findings in prose paragraphs without the structured block.** The synth script won't see them.
- **Don't use emoji severity markers.** The regex expects `SEVERITY: <lowercase-word>`.
- **Don't report the same finding twice across agents.** Reference the prior finding instead.
- **Don't claim CERTAINTY: definite when you inferred from code analysis.** That's `probable`. Save `definite` for reproduced observations.
- **Don't escalate SEVERITY to force attention.** A wrong token count is `major`, not `critical`. Critical is reserved for credential leaks or data corruption.
