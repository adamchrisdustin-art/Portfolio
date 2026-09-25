# Model / Provider Evaluation Framework

Phase 6 deliverable per `06_PHASE_6_MODEL_PROVIDER_EVALUATION.md`. Built
2026-09-23. **The framework's first live run happened 2026-09-25**,
through `openai:gpt-4o-mini` only (no `ANTHROPIC_API_KEY` was set for
that run) — see "Live run results" below for the real numbers. No repo
secret or committed `.env` was ever used for this; the key was set as a
local, unstaged shell environment variable for the one command, per the
safe handling this file already recommended.

## What exists

All under `cms-intelligence/evaluation/`, fully unit-tested (19 tests,
`npm test`) against this repo's **real** `ModelProvider` implementations
(`providers/anthropic.ts`, `providers/openai.ts`) with `fetch` mocked —
so the acceptance criterion below is proven without spending anything:

| File | Phase 6 requirement it satisfies |
|---|---|
| `types.ts` | Evaluation schema (`BenchmarkTask`, `EvaluationResult`, `ProviderRunResult`, `CostEstimate`) |
| `benchmarkSuite.ts` | The 12-task benchmark suite + golden records |
| `scorer.ts` | Deterministic scoring logic (facts/forbidden-claims/refusal/citation) |
| `runner.ts` | Runs the suite through any `ModelProvider`, aggregates results |
| `costModel.ts` | Economics — cost per question/insight/refresh/monitoring-run |
| `workloadModel.ts` | The "Claude Max / API decision" workload calculator |
| `router.ts` | Task-category → model-tier routing |
| `comparisonReport.ts` | Human-readable comparison report generator |
| `run-live-evaluation.ts` | The one script that spends real money — run once, 2026-09-25 |

The provider adapter interface itself (`providers/types.ts`) predates
Phase 6 — built in Phase 3 — and already satisfies "only the model
adapter should know which provider is being called."

## The benchmark suite is grounded, not invented

Every fact in every task's context was pulled from a real
`runFullSweep()` run against this repo's actual committed data on
2026-09-23/24 (all 4 real sources, 9 real insights) — see
`benchmarkSuite.ts`'s header for the full derivation. Two tasks (MA
enrollment summary, an unsupported plan-switching inference) are
deliberately unanswerable with this system's current real data — correct
model behavior is to say so, which is itself the governance property
Phase 6 asks this framework to measure.

## Acceptance criterion — met

> "The same benchmark can be run through at least two providers or two
> model configurations with the same input and scoring logic."

`runner.test.ts` runs the identical 12-task suite through
`createAnthropicProvider()` and `createOpenAIProvider()` (this repo's
real provider code, not a stand-in), with `fetch` mocked to return the
same canned answer through both request shapes, and confirms both
produce the same aggregate score under the same `scorer.ts` logic.

## Economics — real, verified pricing, not a guess

Pricing in `costModel.ts` was verified live on 2026-09-23 (Claude's
pricing page fetched directly; OpenAI's cross-checked via search, since a
direct fetch of `openai.com/api/pricing` returned 403) — re-verify before
a real budget decision, same caveat every `SOURCE_REGISTRY.md` entry
carries.

Traced against this repo's actual code (not a hypothetical): **two
places can call an LLM as of 2026-09-23** — `synthesis.ts`'s
executive-narrative step (gated, 300-token output cap, once per
`fullSweep()`) and the new salience/triage layer
(`intelligence/salience/selectNoteworthy.ts`, gated, 500-token output
cap, called once per ranked selection that has more real candidates
than it shows — as of 2026-09-24, 8 of the 9 real agents use it, for
16 selection calls per full sweep, measured against the real committed
data). No agent computes a
*number* via an LLM call; every real fact is still deterministic code -
the LLM step only selects among and explains real, already-computed
candidates. At current verified pricing that's still a fraction of a
cent per call on either provider's default (cheap) tier — the full
benchmark suite through both providers costs under $0.05. See
`costModel.test.ts`'s explicit assertion that every estimate stays under
$1/run.

**This means the $100 Anthropic credit and the 2026-11-04 deadline
(`MANIFEST.md`) are very unlikely to be a binding constraint for this
system's actual measured LLM footprint** — worth flagging as good news,
not a problem: the deadline is about not letting unused credit expire,
not about running out.

## Budgeting once the API is connected — cadence vs. cost

Answering Adam's direct question (2026-09-23): once a key is connected
and the pipeline runs unattended, the real cost driver is **run
frequency**, not per-call price — even with every agent doing its own
salience-reasoning call (8 of 9 real agents already can, as of
2026-09-24), plus the existing synthesis call, this stays cheap at this
project's committed cadence. The table below was sized at ~12 calls per
sweep (one per agent plus synthesis); the real measured count after the
retrofit is 17 (16 salience + 1 synthesis — some insights have more than
one ranked list), so scale these figures by ~1.4× — still well under the
recommended budget below:

| Cadence | Calls/year (≈11 agents + 1 synthesis) | Est. cost/year (Haiku) | Est. cost/year (Sonnet) |
|---|---|---|---|
| Quarterly (this project's committed cadence) | ~44 | ~$0.10 | ~$0.20 |
| Monthly | ~132 | ~$0.30 | ~$0.60 |
| Weekly | ~572 | ~$1.30 | ~$2.60 |
| Daily | ~4,015 | ~$9 | ~$18 |

**Recommendation: budget $5–10/year and set a $20 hard spend cap in the
provider console** (per `CLAUDE.md`'s guardrail that a cap must exist
before any agent goes live). Even fully autonomous reasoning across
every agent doesn't threaten the $100 credit at this project's quarterly
cadence — it only becomes a real number at daily-or-faster cadence, and
even then stays well under $100/year at current pricing.

## The Claude Max / API decision — resolved with real numbers

`workloadModel.ts`'s `assessWorkload()`, run against this repo's real
traced inputs (`REAL_WORKLOAD_INPUTS`):

- **Development**: the Max subscription (Claude Code) is sufficient for
  all interactive build/test/research work, unconditionally — this
  doesn't change based on workload size.
- **Production**: a real API key is required, but only for the
  **quarterly scheduled run** (`COST_AND_OPERATING_MODEL.md`'s cadence) —
  4 calls/year at current observed shape. The live dashboard itself
  never calls an LLM (`app/healthcare-intelligence/page.tsx` calls
  `runFullSweep()` with no arguments, which hardcodes `modelProvider:
  null` — confirmed by reading the code, not assumed). There is currently
  no code path anywhere that would call an LLM from a visitor's page
  load, regardless of what env vars exist in the hosting environment.

## Live run results (2026-09-25)

Real, billed run through `openai:gpt-4o-mini` — full output in
`data/healthcare-intelligence/evaluation-runs/2026-09-25-results.json`
and `2026-09-25-comparison-report.md`. No `ANTHROPIC_API_KEY` was set for
this run, so this is one provider's real measurement, not yet the
cross-provider comparison Phase 6's acceptance criterion describes —
that still needs a second live run through Anthropic.

| Metric | Result |
|---|---|
| Mean score | 0.59 / 1.0 |
| Schema compliance | 100% (12/12) |
| Forbidden-claim rate | 8% (1/12) |
| Refusal accuracy | 67% |
| Source citation | 33% |
| Mean latency | 2,487ms |
| Real measured cost | $0.00027/question (~$0.003 for the full 12-task suite) — confirms the Economics section's estimate above, not a guess anymore |

Two real, non-mocked findings worth acting on if `gpt-4o-mini` is ever
routed into a live agent path, not just noise in the aggregate score:
- **`cms-eval-002-reimbursement-change` scored 0.00 and tripped a
  forbidden-claim flag**: the model claimed "full national" coverage of
  data that's actually a real 5-state sample — exactly the overclaim
  `CLAUDE.md`'s guardrails exist to prevent, caught correctly by the
  scorer.
- **`cms-eval-006-site-of-care-change` also scored 0.00**: this task
  expects a refusal/gap acknowledgment (the underlying data doesn't
  support an answer) and the model appears to have fabricated one
  instead of declining.
- Source citation (33%) is the weakest dimension overall — the model
  usually got the substance right without naming which real source
  backed it.

## Routing strategy — still provisional pending a second provider

`router.ts` maps each benchmark category to a tier
(`deterministic`/`efficient`/`strong`), and now has one real data point
behind the `efficient` tier (`gpt-4o-mini`'s 0.59 mean score above) —
still not a comparative routing decision, since no Anthropic run exists
yet to compare it against. Revisit `recommendTier()` once a second live
run through `createAnthropicProvider()` gives `comparisonReport.ts`
something real to compare, not mocked, data.

## Running it for real

```
ANTHROPIC_API_KEY=... npx tsx cms-intelligence/evaluation/run-live-evaluation.ts
```

Writes `data/healthcare-intelligence/evaluation-runs/<date>-results.json`
and `<date>-comparison-report.md`. Costs real money (see Economics above
for the expected size — trivial) and is not wired into any scheduled
workflow; it only runs when someone deliberately invokes it with a key
set. Per `COST_AND_OPERATING_MODEL.md`, do this only after the Phase 4/5
data-source backfill is safely complete.
