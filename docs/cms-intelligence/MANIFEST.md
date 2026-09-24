# Prompt Pack Manifest

## Start here (2026-09-23)

**Phases 1–6 scaffolding are complete and committed**, plus Federal
Register and MA/Part D data-source addenda on top of Phase 5, and a new
salience/triage reasoning layer (see History below). The dashboard is
live locally at `/healthcare-intelligence`, working end to end, 111
tests passing, clean build. **Phase 6's evaluation framework is
built and tested but has not run live** — no API key is configured
anywhere for this project; see `MODEL_EVALUATION.md` for the framework's
real state, verified current pricing, and the resolved Claude Max/API
decision. **Next up: Phase 7** (hardening, testing, portfolio write-up)
— see `07_PHASE_7_HARDENING_TESTING_AND_PORTFOLIO.md` — after finishing
the remaining data-source priority order below (MA/Part D next).

**What's real right now:**
- 5 independently live-verified data sources wired: Hospital General
  Information, Home Health Care Agencies, Medicare Physician & Other
  Practitioners (5-state sample), the Federal Register API filtered to
  CMS (rolling 120-day window), and CMS's MA/Part D Monthly Enrollment
  by Plan file — see `SOURCE_REGISTRY.md`.
- 7 of 11 domain agents produce real, evidence-backed insights (Market
  Growth ×2, Claims/Utilization/Cost, Reimbursement & Payment, Provider
  & Network, Emerging Trends, Policy/Regulation/CMS ×3, MA/Part D ×2). 2
  are honest stubs with no data yet (Medicaid/CHIP/Duals, Marketplace).
  2 are infrastructure-only (Source Monitor, Data Architecture). All 7
  dashboard layers now have at least one real finding — "Policy &
  Program Watch" is no longer empty.
- New salience/triage reasoning layer
  (`cms-intelligence/intelligence/salience/selectNoteworthy.ts`, added
  2026-09-23 after Adam asked why every agent's "what's worth surfacing"
  logic was a fixed top-N rule): splits real fact computation (stays
  deterministic code, unchanged) from selecting/explaining which real
  candidates matter this cycle (a new, narrow LLM step that can only
  choose among and explain given candidates, never invent one). Falls
  back to the exact prior deterministic ranking whenever no model is
  configured, which is true for this deployment today - zero behavior
  change, zero cost, by default. First used in the MA/Part D agent's
  plan-type mix insight; not yet retrofitted into the other 6 real
  agents (they still use their original fixed top-N logic) pending
  Adam's go-ahead on that broader change.
- MA/Part D agent has a binding privacy/naming design constraint worth
  knowing: the real source file names a carrier/plan on every row: this
  agent's adapter drops every named field before it's ever persisted, so
  no insight can name a real carrier (CLAUDE.md forbids naming
  UnitedHealthcare/Optum, and this project's practice extends that to
  every real carrier) - enforced structurally, not by a runtime filter
  that could be forgotten. Verified with an explicit test.
- The Policy agent's deterministic code covers rule-cycle tracking
  (finalized/proposed/upcoming-effective — Q074-Q076); routing a rule to
  the specific domain(s) it affects (Q077-Q080) is explicitly that
  agent's LLM step per `AGENT_ARCHITECTURE.md` and stays unimplemented
  until Phase 6 wires in a live model provider — not guessed at.
- Dashboard: 7 layers, evidence drawers, a standalone "Data Explorer"
  BI-style analytics section (`components/AnalyticsExplorer.tsx`) with
  real bar/donut/boxplot/line charts and KPI tiles, separate from the
  per-agent finding cards.
- Confidence/trend detection is computed dynamically from real snapshot
  history (`cms-intelligence/data/sources/snapshotHistory.ts`), never
  hardcoded — currently low across the board because there's genuinely
  only ~1 week of real history, which is correct, not a bug.
- Phase 6 evaluation framework (`cms-intelligence/evaluation/`): a
  12-task grounded benchmark suite, deterministic scorer, cost model
  (real verified 2026-09-23 pricing), workload model, and a router —
  proven against this repo's real Anthropic/OpenAI provider code with
  `fetch` mocked (19 tests). **Not yet run live** — see
  `MODEL_EVALUATION.md`. Traced fact worth knowing before spending
  anything: this repo has exactly one real LLM call site today
  (`synthesis.ts`'s executive narrative), so the actual measured cost
  footprint is a fraction of a cent per scheduled run, not a material
  fraction of the $100 credit.

**Binding rules for every future phase:**
- No "UnitedHealthcare"/"Optum" naming in anything published to the live
  site — internal-only framing, see project memory /
  `healthcare-intelligence-no-uhc-optum-naming` memory.
- Quarterly-to-annual pull cadence, not weekly (`COST_AND_OPERATING_MODEL.md`).
- **Hard deadline: the initial LLM-synthesis backfill must complete
  before 2026-11-04** (the $100 Anthropic credit's constraint — pulling
  more public data is free and untouched by this deadline; only a real
  scheduled LLM call spends it, and none has happened yet).
- Remaining data-source priority order (per Adam, 2026-09-23): Federal
  Register API done, MA/Part D enrollment done (see above) →
  **Marketplace PUFs next** → Medicaid/T-MSIS (deprioritized, most
  fragmented).
- No naming a specific real carrier/insurer (UnitedHealthcare/Optum
  explicitly per CLAUDE.md, and every other real carrier by this
  project's extended practice) anywhere published to the site - applies
  to any future data source that includes named entities (e.g.
  Marketplace PUFs will likely name issuers too), same pattern the
  MA/Part D adapter established: drop named fields at the adapter layer,
  never rely on a downstream filter.

**If picking this up in a new session:** read this file, then
`00_MASTER_ORCHESTRATOR.md`, `COST_AND_OPERATING_MODEL.md`, and whichever
phase file is next — the "History" section below has the detailed
blow-by-blow if something needs archaeology, but shouldn't be required
reading to continue the work.

## Pack contents

- 00_README_START_HERE.md — how to use the pack
- 00_MASTER_ORCHESTRATOR.md — full-program instruction set
- 01_PHASE_1_REPOSITORY_DISCOVERY.md — inspect and integrate with existing portfolio
- 02_PHASE_2_INTELLIGENCE_BLUEPRINT.md — questions, agents, metrics, evidence, dashboard blueprint
- 03_PHASE_3_AGENT_IMPLEMENTATION.md — implement the agent architecture
- 04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md — CMS/public data and source monitoring
- 05_PHASE_5_DASHBOARD_AND_UX.md — executive dashboard and portfolio experience
- 06_PHASE_6_MODEL_PROVIDER_EVALUATION.md — Claude/OpenAI/open-source/Cerebras evaluation and cost framework
- `MODEL_EVALUATION.md` — Phase 6 deliverable: the evaluation framework's real state, economics, and the Claude Max/API decision
- 07_PHASE_7_HARDENING_TESTING_AND_PORTFOLIO.md — production-quality testing and case study
- 08_AGENT_PROMPT_TEMPLATE.md — reusable agent definition template
- 09_PROJECT_DIRECTORY_RECOMMENDATION.md — target architecture
- 10_EXECUTIVE_QUESTION_STARTER.md — starter question library
- COST_AND_OPERATING_MODEL.md — cost/scheduling architecture (decided 2026-09-23, read alongside Phase 6)
- Phase 1 deliverables: `REPOSITORY_DISCOVERY.md`, `PROJECT_BOUNDARY.md`
- Phase 2 deliverables: `EXECUTIVE_QUESTION_CATALOG.md` (112 questions), `AGENT_ARCHITECTURE.md`, `EVIDENCE_MODEL.md`, `METRIC_DICTIONARY.md`, `TREND_FRAMEWORK.md`, `DASHBOARD_BLUEPRINT.md`, `DATA_GAP_REGISTER.md`
- Phase 4 deliverables: `SOURCE_REGISTRY.md`, `DATA_INGESTION.md`, `SCHEMA_MAPPING.md`, `DATA_LINEAGE.md`, `DATA_QUALITY.md`

## History (detailed changelog, not required reading)

Phase 1 (repository discovery), Phase 2 (intelligence blueprint), and
Phase 3 (agent implementation — evidence schema/validator, metrics/trend
modules, Anthropic+OpenAI provider abstraction, 11 agents + shared
orchestrator, 12 `.claude/agents/*.md` subagent definitions, `vitest`
added as this repo's first test runner) completed 2026-09-23 in sequence,
each verified before moving on.

Phase 4 (data source & pipeline) added the source registry, generalized
source-change-monitor diffing, data-quality checks, provenance records,
and the 6 public-data-first adapter interfaces, plus the first real
dataset beyond Hospital General Information (Home Health Care Agencies).

Phase 5 (dashboard & UX) shipped the live route, then went through six
rounds of direct feedback on the running page, each fixed rather than
argued with:

1. Confidence looked permanently stuck at "low" with no charts — fixed
   by deriving confidence dynamically from real history instead of
   hardcoding it, and shipping the first real chart (`Sparkline`).
2. Dashboard leaned on one data source with no visible agent
   collaboration — added a 3rd independent dataset (Medicare Physician &
   Other Practitioners, bounded to a 5-state sample after a full pull
   hit 112MB), filled the empty Reimbursement agent, gave Emerging
   Trends a real cross-dataset correlation, surfaced the
   Executive-Pulse synthesis narrative that existed in code but was
   never rendered.
3. Asked for NPS by facility type and a demand-side "opportunity"
   signal — corrected that CMS doesn't publish NPS (used real star
   ratings instead), and built a real capacity signal using a demand
   proxy already in the data (episodes per agency) rather than reaching
   for external population data.
4. "Still no charts" after the sparkline — root cause was conflating
   "not enough history for a *trend* chart" with "no charts at all";
   loaded the `dataviz` skill and built real `BarChart`/`DonutChart`/
   `BoxPlot`/`StatTile` components, catching and fixing a boxplot bug
   (raw min/max whiskers vs. the standard Tukey convention) along the way.
5. Wanted those charts *plus* a standalone Tableau-style analytics
   section separate from agent cards — built `AnalyticsExplorer.tsx`
   ("Data Explorer"), deliberately skipping a dual-axis chart (a known
   anti-pattern) and a geographic map (no verified boundary data), both
   stated explicitly rather than silently omitted; fixed a real bug
   where a CMS suppression marker was rendering as a fake rating category.
6. Reported chart labels clipped off the edge of cards (a real bug — a
   fixed 64px label column truncated real labels like "Diagnostic
   Radiology") — fixed with dynamic label-width sizing, horizontal
   scroll wrappers, and centering across every chart component.

74 tests passing throughout, re-verified in a real browser after every
round. Full narrative detail (if ever needed) is in the session history
and the `adamdustin-me-portfolio-project` memory file, not duplicated
here a second time.

A Federal Register data-source addendum (2026-09-23, after Phase 5)
implemented the top item in Adam's data-source priority order: verified
the Federal Register API live for CMS-attributed documents, built
`cms-intelligence/data/adapters/federalRegisterDocuments.ts` (rolling
120-day window, bounded single-request pull) and its pull script, and
wired the previously-stub Policy, Regulation & CMS Program Intelligence
agent to it — 3 new real insights (finalized rules, proposed-not-final
rules, upcoming effective dates), each with a real bar chart. Added two
Data Explorer visuals (document-type donut, rules-per-month bar) from
the same real data. Fixed a pre-existing gap in
`.github/workflows/healthcare-intelligence-pipeline.yml`, which pulled
Home Health but never re-pulled the Medicare Physician & Other
Practitioners dataset — both that pull and the new Federal Register pull
are now in the quarterly cron. 78 tests passing, clean `next build`,
verified in a real running instance (not just tests) that the Policy &
Program Watch layer now renders real findings instead of the empty
state.

Phase 6 (model/provider evaluation, 2026-09-23) built the framework
`06_PHASE_6_MODEL_PROVIDER_EVALUATION.md` specifies:
`cms-intelligence/evaluation/` — a 12-task benchmark suite grounded in
this repo's real data (not invented facts), a deterministic scorer, a
runner proven against this repo's real Anthropic/OpenAI provider
implementations (fetch mocked, no real spend), a cost model built on
pricing verified live that day, a workload model resolving the Claude
Max/API decision with real traced numbers, a router, and a comparison-
report generator. Deliberately did NOT run the suite against real
providers — no API key is configured anywhere for this project, and
`COST_AND_OPERATING_MODEL.md` explicitly says Phase 6 shouldn't compete
with the still-pending Phase 4/5 data-source backfill for the same
credit. See `MODEL_EVALUATION.md` for the full writeup, including the
finding that this repo's actual LLM footprint (one call site, gated,
capped) makes the $100/Nov-4-deadline framing a low-risk one, not a
tight constraint.

Same session, 2026-09-23: Adam asked two follow-up questions that
changed the architecture and the docs. (1) "Shouldn't agents reason
about what's noteworthy instead of always picking the same signals?" -
answered by building `cms-intelligence/intelligence/salience/
selectNoteworthy.ts`, a shared module that splits fact computation
(stays deterministic) from candidate selection/explanation (a new,
narrow LLM step that can't invent a candidate or number, falls back to
the old fixed top-N ranking with no model configured). (2) "How much
should I budget once the API is connected and agents run autonomously?"
- answered with a real cadence-vs-cost table in the chat response and
folded into `MODEL_EVALUATION.md`; traced that even a fully-reasoning
11-agent system stays under $10/year at quarterly cadence. Then, per
Adam's "continue to the next sources": verified CMS's MA/Part D Monthly
Enrollment by Plan file live (a different platform from the other CMS
sources - a monthly zip discovered by crawling real page structure, not
a query API), added `fflate` as this repo's first binary-parsing
dependency, built `maPartDEnrollment.ts` and the MA/Part D agent (using
the new salience layer as its reference implementation), and - a design
decision worth remembering for the next source (Marketplace PUFs will
likely have the same issue) - discovered the raw file names a real
carrier on every row and designed the adapter to drop every named field
at parse time, never persisting a name past the adapter, so CLAUDE.md's
"never name UnitedHealthcare/Optum" rule (extended in practice to every
real carrier) is structurally impossible to violate rather than relying
on a downstream filter. 111 tests passing, clean build, verified live in
a running instance including an explicit grep for forbidden carrier
names in the rendered HTML (found none).
