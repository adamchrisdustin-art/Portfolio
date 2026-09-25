# Model / Provider Evaluation Framework

Phase 6 deliverable per `06_PHASE_6_MODEL_PROVIDER_EVALUATION.md`. Built
2026-09-23. **Run live 2026-09-25 across six models from two providers**
(Claude Haiku 4.5, Sonnet 5 and Opus 5.5; gpt-4o-mini, GPT-6 Luna and
GPT-6 Sol), which meets Phase 6's cross-provider acceptance criterion with
real data. See "Live run results" for the numbers, the three measurement
bugs found along the way, and the routing decision they led to. Keys were
set as local shell environment variables for each run, never committed.

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

*(As of 2026-09-25 there's a third call site: the executive analyst in
`cms-intelligence/reasoning/`, one call per monthly run. See "Routing"
below; the autonomous run costs roughly $1/year.)*

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

Three real, billed runs on 2026-09-25. The definitive one is the
six-model run, `data/healthcare-intelligence/evaluation-runs/2026-09-25T06-17-06-*`:
every model on the same 12 tasks, in one pass, with a 4,096-token output
ceiling. Scores below are **after** the scorer fixes described next,
re-scored from the saved answers with `rescore.ts` (no new API calls).

| Model | Mean score | Forbidden claims | Refusal accuracy | Source citation | Mean latency | Est. cost/question |
|---|---|---|---|---|---|---|
| `anthropic:claude-opus-5-5` | **0.92** | 0% | 100% | **75%** | 7.0s | $0.0089 |
| `anthropic:claude-sonnet-5` | 0.85 | 0% | 100% | 50% | 5.7s | $0.0044 |
| `anthropic:claude-haiku-4-5-20251001` | 0.74 | 0% | 100% | 33% | 2.1s | $0.0022 |
| `openai:gpt-6-sol` | 0.72 | 0% | 100% | 33% | 3.8s | $0.0044 |
| `openai:gpt-4o-mini` | 0.70 | 0% | 100% | 33% | 2.8s | $0.0003 |
| `openai:gpt-6-luna` | 0.68 | 0% | 100% | 33% | 2.3s | $0.0002 |

Reading it honestly:
- **Every model behaved safely.** All six refused both unanswerable
  questions and disclaimed the 5-state sample correctly. The differences
  are fact recall and source citation, not honesty.
- **Opus 5.5 and Sonnet 5 pull away on the synthesis tasks.** Both scored
  1.00 on executive synthesis and geographic comparison, where every
  other model scored 0.47-0.70. Only Opus scored 1.00 on emerging-signal
  detection and provider concentration.
- **The bottom four are within noise of each other.** Haiku scored 0.80
  in an earlier run and 0.74 here; with 12 tasks, gaps under about 0.06
  shouldn't decide anything.
- GPT-6 Sol and Luna were released 2026-09-22; pricing was verified live
  the day of this run (`costModel.ts`).

### Three measurement bugs found and fixed along the way

Each would have made the numbers above wrong. None was the models' fault.

1. **Output cap truncation.** The first Opus run was cut off mid-answer at
   the original 400-token cap before stating the facts the scorer checks,
   scoring 0.66. Cap raised to 4,096 (`runner.ts`). Billing is per token
   generated, so the headroom costs nothing, and both providers now log a
   warning whenever a response is truncated.
2. **Negated phrases counted as forbidden claims.** All six models wrote
   "not the full national file" on the reimbursement task, which is the
   correct caveat, and all six were penalized for the phrase "full
   national." Forbidden claims now only count when asserted, not
   negated (`scorer.ts`).
3. **Correct refusals not recognized.** On the site-of-care task, all six
   models said plainly that the data couldn't answer it, but phrasings like
   "cannot answer" and curly apostrophes ("doesn’t") weren't in the
   refusal detector, so every model was scored as "possible fabrication."

Bugs 2 and 3 are why the earlier single-provider write-ups on this date
reported a "full national" overclaim and a fabricated answer as shared
model failures. Both claims were wrong; the models were right. `scorer.test.ts`
now pins the real answers that were mis-scored, plus the opposite cases,
so the fixes can't drift into leniency. A pricing-ID mismatch
(`claude-opus-5.5` vs. the real `claude-opus-5-5`) also made Opus show as
"unpriced" until fixed.

## Salience benchmark (2026-09-25)

The 12-task suite asks open-ended questions; it never tested the narrow
job salience does. So `salienceBenchmark.ts` captures the **16 real
prompts production sends** (one per ranked selection with more candidates
than it shows) and judges every answer with production's own acceptance
rule. Answers that production would reject fall back to the fixed ranking,
which is safe but means the model added nothing. Runs:
`evaluation-runs/2026-09-25T16-58-47-salience-*` for all six models, and
`2026-09-25T17-09-19-salience-*` for Sonnet and Opus rerun at low effort.

| Model | Accepted | Est. cost per monthly run | Notes |
|---|---|---|---|
| `openai:gpt-6-luna` | **100%** | **$0.006** | **Chosen.** Reasons describe each item's substance. |
| `openai:gpt-6-sol` | 100% | $0.11 | Reasons as useful as Luna's, at about 20× the cost. |
| `anthropic:claude-sonnet-5` (low effort) | 94% | $0.11 | At default effort, 3 of 16 calls failed: it thought through the whole output budget before answering. |
| `anthropic:claude-haiku-4-5-20251001` | 88% | $0.06 | Rejections were numbers it calculated ("61 days"). |
| `anthropic:claude-opus-5-5` (low effort) | 81% | $0.24 | Same calculated-number rejections ("all 46 candidates"). |
| `openai:gpt-4o-mini` | 81% | $0.008 | Invented candidate IDs 3 times, including a nonexistent document number. |

What this changed in production code:
- **Thinking effort per call.** Sonnet 5 and Opus 5.5 think by default,
  and thinking tokens count against the output cap. Salience and
  synthesis now send `effort: "low"`, and the executive analyst sends
  `effort: "high"` with a 16,000-token cap. Haiku 4.5 rejects the field,
  so the provider never sends it there.
- **Output caps.** Salience 500 → 4,096 tokens, synthesis 300 → 1,024.
  These are ceilings, not charges.
- **Grounding accepts abbreviations.** "$109.4M" now counts as grounded
  by $109,438,442. Numbers a model calculates itself (day spans, sums,
  counts) are still rejected, by design.

Known weakness of the benchmark: its "specific reason" metric misses
single-digit facts ("7 days out") and paraphrased titles. When the metric
disagreed with the rankings, the raw answers were read directly.

## Routing — decided from the results above

Used by the autonomous monthly run
(`cms-intelligence/reasoning/run-monthly-reasoning.ts`, overridable via
`SALIENCE_MODEL` / `ANALYST_MODEL`):

| Job | Model | Why |
|---|---|---|
| Computing every number, trend, and diff | Deterministic code | $0 and more reliable than any model. This was never an LLM job. |
| Per-agent salience picks (16 calls/run) | `openai:gpt-6-luna` | Measured on the real salience prompts: 100% accepted by production's rule, and the cheapest model tested ($0.006/run). Matches Adam's preference for OpenAI on cheap tasks. |
| Executive analyst (1 call/run) | `anthropic:claude-opus-5-5` | The judgment a healthcare leader actually reads. Highest score, best source citation, top marks on synthesis, and about $1/year at one call a month. |

This deliberately goes past `CLAUDE.md`'s earlier "Haiku default,
escalate to Sonnet" wording. That guardrail was written before any
measured data existed, and it's been updated to match.

## Running it for real

```
ANTHROPIC_API_KEY=... OPENAI_API_KEY=... \
ANTHROPIC_MODEL=claude-haiku-4-5-20251001,claude-sonnet-5,claude-opus-5-5 \
OPENAI_MODEL=gpt-4o-mini,gpt-6-luna,gpt-6-sol \
npx tsx cms-intelligence/evaluation/run-live-evaluation.ts
```

Writes timestamped `evaluation-runs/<timestamp>-results.json` and
`-comparison-report.md`. Costs real money (well under $1 for all six
models) and is not wired into any scheduled workflow. After changing the
scorer, run `npx tsx cms-intelligence/evaluation/rescore.ts` to re-score
every saved run for free.
