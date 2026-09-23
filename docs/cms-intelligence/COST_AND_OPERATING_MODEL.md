# Cost & Operating Model

Decided 2026-09-23, before Phase 1 implementation started. Read this alongside
`00_MASTER_ORCHESTRATOR.md`'s Phase 6 section and `ROADMAP.md`'s budget
guardrails - this file resolves how those apply operationally to the 12-agent
system.

## Interactive build vs. automated runtime - different cost models

- **Interactive development** (Claude Code building/testing/populating agents
  in a session, same as this conversation) draws on the Claude Max20
  subscription - no separate per-token cost. Use this for initial build-out
  and for populating the dashboard's first real data.
- **Scheduled/automated runs** (GitHub Actions cron invoking an agent
  unattended) CANNOT run off the Max plan - there is no supported way for a
  headless background job to draw from a personal claude.ai subscription's
  usage. These always need a real API key (Anthropic or OpenAI) and are
  billed per token, separate from Max. Don't design around the Max plan
  covering any unattended/automated piece.

## Build pacing vs. runtime cost - two different levers, don't conflate them

- Rolling out the 12 domain agents gradually (e.g., roughly one per month)
  is a reasonable way to manage build/review complexity. It does NOT by
  itself reduce ongoing API spend - an agent costs money only when it's
  actually deployed and running on a schedule, regardless of which month it
  was built in.
- The real cost lever is: model tier (cheapest capable tier, matching
  `pipeline/analystAgent.ts`'s `gpt-4o-mini` default), hard output token
  caps, and run frequency (weekly/monthly, never per-page-view). Apply this
  uniformly to every agent from the day it's deployed, not just the early
  ones.
- The dashboard must always read pre-computed/cached results from scheduled
  runs. Never re-run an agent live on a visitor's page load.

## Gate expensive calls behind cheap deterministic checks

The "Data Source & CMS Change Monitor" agent (#11) should run cheaply and
often (pure diffing, no LLM) and only wake the other domain agents when its
diff actually contains something material. If nothing changed, nothing
downstream gets called - not "called with an empty prompt," not called at
all.

This pattern is already implemented and proven in the existing single-dataset
pipeline: `pipeline/analystAgent.ts` skips its OpenAI call entirely when
`hasMaterialChange(diff)` is false, rather than spending a call to describe
"nothing changed" (a result the free rule-based summary already fully
covers). Use the same gating shape for every agent in the 12-agent system,
not just this one pipeline.

## Still open

Phase 6 (multi-provider LLM evaluation) is a separate concern from the
12 agents' operating schedule above - treat it as a bounded, occasional
experiment (e.g., once when choosing a production model, maybe revisited
annually), not a recurring monthly cost line. Confirm this explicitly before
Phase 6 starts rather than letting it default to "ongoing."
