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
  `pipeline/analystAgent.ts`'s `gpt-4o-mini` default and
  `cms-intelligence/providers/anthropic.ts`'s Haiku default), hard output
  token caps, and run frequency. Apply this uniformly to every agent from
  the day it's deployed, not just the early ones.
- The dashboard must always read pre-computed/cached results from scheduled
  runs. Never re-run an agent live on a visitor's page load.

## Run cadence: monthly data pulls (revised 2026-09-25)

Originally decided 2026-09-23 as quarterly-to-annual. **Revised 2026-09-25
to monthly for data pulls**, per Adam, on the reasoning that pulling public
data costs nothing (plain HTTP on GitHub Actions' free public-repo
minutes, no LLM call), so there's no cost reason to wait a quarter:

- `.github/workflows/healthcare-intelligence-pipeline.yml` pulls every
  source on the 1st of each month. Track C v1's weekly cron
  (`pipeline/cms-pipeline.yml`) stays weekly and untouched (see
  `PROJECT_BOUNDARY.md` - the two systems' cadences are independent
  decisions).
- Some sources genuinely publish monthly or faster (MA/Part D enrollment,
  Federal Register, SEC 8-Ks, openFDA, NIH RePORTER, ClinicalTrials.gov),
  so monthly picks up real new information from them. Others refresh
  quarterly (Hospital General Information, Home Health Care Agencies) or
  annually (Physician & Other Practitioners, Marketplace Rate PUF), so most
  monthly pulls of those will find nothing new. That's expected and costs
  nothing; the real cost is repo growth, about 20MB of raw JSON per full
  pull, which git compresses heavily (the whole repo's history was 3.1MB
  on 2026-09-25).
- Any LLM reasoning over new data must stay behind the change gate below:
  a pull that found nothing new should trigger no model call at all.

## The $100 Anthropic credit: one-time backfill, then steady state

> **Correction (2026-09-25): the premise of this section was wrong.** The
> $100 credit expiring 2026-11-04 turned out to be **Claude Code
> cloud-session credit**: it applies automatically to Claude Code cloud
> sessions and is "not eligible for Projects and Routines," per its own
> terms screen. It is **not** Developer Platform API credit, so it can't pay
> for this project's agents, which call `api.anthropic.com` with an API
> key billed separately. The Nov 4 deadline below does not constrain this
> project's API spend. Real measured API cost is tiny anyway (see
> `MODEL_EVALUATION.md`'s live results). The original text is kept below as
> a record of the decision as it was made.

Decided 2026-09-23. Adam has $100 in Anthropic API credit earmarked for this
project (see `DEPLOYMENT.md`'s "what's not set up yet" section for the
`ANTHROPIC_API_KEY` setup steps).

- **Hard deadline: the initial backfill/population run must complete before
  2026-11-04.** Treat this as a real constraint on Phase 4/5 sequencing, not
  a soft target - if the credit expires or resets on that date, an
  incomplete backfill after it either costs real out-of-pocket money to
  finish or has to be redone under whatever the next funding arrangement is.
- Expect the **initial backfill to consume most of the $100** - populating
  the dashboard's first real data and first real LLM-synthesized insights
  across multiple datasets and (up to) 11 domain agents is a one-time,
  larger spend than any single subsequent run. This is expected and fine;
  don't try to artificially shrink the backfill to preserve credit for
  later at the cost of leaving the dashboard's first population incomplete.
- After the backfill, steady-state cost is low by design: quarterly/annual
  cadence (above) + Haiku-tier default + hard output caps + the agent #11
  gate (no material change -> no LLM call at all) together should keep any
  residual credit lasting well past a single quarter.
- Sequencing implication for Phase 4/5: prioritize getting the backfill run
  *correct* over getting it *fast* - a wrong or wasteful backfill burns
  credit that can't be recovered before the deadline, so validate each new
  data adapter and agent's real LLM call on a small/cheap test before
  running the full backfill across all datasets.

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

## Phase 6 (resolved 2026-09-23)

Multi-provider LLM evaluation is a separate concern from the 12 agents'
operating schedule above: a bounded, occasional experiment funded out of
the same $100 credit (or revisited later if/when it matters again), not a
recurring cost line. Should not run before the Phase 4/5 backfill above is
safely complete, given the November 4 deadline - don't let a Phase 6
experiment compete with the backfill for the same limited credit.
