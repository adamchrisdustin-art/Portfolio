# Prompt Pack Manifest

## Start here (2026-09-24)

**Phases 1–6 are built and live.** The dashboard runs at
`/healthcare-intelligence`, live in production at adamdustin.me
(auto-deploys from `main` via Vercel — see `DEPLOYMENT.md`), 121 tests
passing, clean build. No phase is "next" by default — Phase 7
(hardening/portfolio write-up), a live Phase 6 provider run, and
retrofitting the salience layer into the remaining agents are all live
options; pick based on what's asked next.

**What's real:**
- **6 data sources wired** (all 3 items on Adam's CMS priority order are
  done): Hospital General Information, Home Health Care Agencies,
  Medicare Physician & Other Practitioners (5-state sample), the Federal
  Register API (CMS filter, rolling 120-day window), CMS's MA/Part D
  Monthly Enrollment by Plan file, and CMS's Marketplace Rate PUF. Full
  detail, verification method, and known limitations for each: `SOURCE_REGISTRY.md`.
  Medicaid/T-MSIS is the only named CMS source left unwired — deliberately
  deprioritized as most fragmented.
- **8 of 11 domain agents produce real, evidence-backed insights**
  (Market Growth ×2, Claims/Utilization/Cost, Reimbursement & Payment,
  Provider & Network, Emerging Trends, Policy/Regulation/CMS ×3, MA/Part
  D ×2, Commercial/Marketplace ×2). Medicaid/CHIP/Duals is the one
  remaining honest stub. 2 agents are infrastructure-only (Source
  Monitor, Data Architecture). All 7 dashboard layers have at least one
  real finding.
- **Salience/triage reasoning layer**
  (`cms-intelligence/intelligence/salience/selectNoteworthy.ts`): splits
  real fact computation (stays deterministic) from selecting/explaining
  which real candidates matter this cycle (a narrow LLM step that can
  only choose among and explain given candidates, never invent one).
  Falls back to the prior deterministic top-N ranking whenever no model
  is configured (true today — zero behavior change, zero cost by
  default). Used in the MA/Part D and Marketplace agents so far; the
  other 6 real agents still use their original fixed top-N logic pending
  a go-ahead to retrofit them.
- **Naming-privacy pattern, revised 2026-09-24**: MA/Part D and
  Marketplace source files both name a real carrier/plan on every row.
  The rule is no longer "drop every named field unconditionally" — a real
  carrier name may reach an insight when it's a genuine, sourced finding
  computed from real data (e.g. MA/Part D's parent-organization enrollment
  ranking, the kind of reading a real industry directory like AIS Health
  publishes), never fabricated or implied-proprietary. MA/Part D's adapter
  now keeps `parentOrganization`/`organizationMarketingName` for exactly
  this. Marketplace's IssuerId stays dropped for a different, narrower
  reason: it's an opaque numeric ID with no verified name crosswalk wired
  in, not a rule against naming carriers from that file in principle (see
  `SOURCE_REGISTRY.md`).
- **Phase 6 evaluation framework** (`cms-intelligence/evaluation/`)
  built and tested, **not run live** — no API key is configured anywhere
  for this project. See `MODEL_EVALUATION.md` for the framework, verified
  current pricing, the resolved Claude Max/API decision, and a real
  cadence-vs-cost table (even fully-autonomous reasoning across every
  agent stays under $10/year at this project's quarterly cadence — the
  $100 credit is not a tight constraint given what actually got built).
- Confidence/trend detection is computed dynamically from real snapshot
  history (`cms-intelligence/data/sources/snapshotHistory.ts`), never
  hardcoded — currently low across the board because there's genuinely
  only ~1 week of real history, which is correct, not a bug.
- Dashboard: 7 layers, evidence drawers, a standalone "Data Explorer"
  BI-style analytics section (`components/AnalyticsExplorer.tsx`),
  separate from the per-agent finding cards. Chart conventions (centering,
  label sizing, Tukey boxplots, no dual-axis/fabricated geography) are
  binding rules now — see `DASHBOARD_BLUEPRINT.md`'s "Chart conventions."

**Binding rules for every future phase:**
- A real carrier/insurer name may appear on the public site only as a
  genuine, sourced finding computed from real data — never fabricated,
  never implied to be this project's own proprietary/internal access to
  that carrier's systems (revised 2026-09-24; see the naming-privacy
  pattern above and the `healthcare-intelligence-no-uhc-optum-naming`
  memory for the full history of this decision).
- Quarterly-to-annual pull cadence, not weekly (`COST_AND_OPERATING_MODEL.md`).
- **Hard deadline: the initial LLM-synthesis backfill must complete
  before 2026-11-04** (the $100 Anthropic credit's constraint — pulling
  public data is free and untouched by this deadline; only a real
  scheduled LLM call spends it, and none has happened yet).
- Chart/visual conventions in `DASHBOARD_BLUEPRINT.md` are binding on
  any new chart component, not just Phase 5's.

**If picking this up in a new session:** read this file, then
`00_MASTER_ORCHESTRATOR.md`, `COST_AND_OPERATING_MODEL.md`, and whichever
phase file is next — the "History" section below is short-form
archaeology, not required reading to continue the work.

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

## History (short-form changelog, not required reading)

**Phases 1–3** (2026-09-23): repository discovery, intelligence
blueprint, and agent implementation — evidence schema/validator,
metrics/trend modules, Anthropic+OpenAI provider abstraction, 11 agents
+ shared orchestrator, 12 subagent definitions, `vitest` added.

**Phase 4**: source registry, source-change-monitor diffing,
data-quality checks, 6 adapter interfaces, first real second dataset
(Home Health Care Agencies).

**Phase 5** (dashboard & UX): shipped the live route, then six rounds of
real fixes driven by direct feedback on the running page — dynamic
confidence instead of hardcoded, a 3rd real dataset (Medicare Physician
& Other Practitioners, 5-state sample after a full pull hit 112MB), a
real cross-dataset correlation, a corrected NPS→real-star-ratings
substitution, real bar/donut/boxplot/stat-tile charts (`dataviz` skill),
the standalone Data Explorer section, and the chart label/centering
fixes now captured as binding rules in `DASHBOARD_BLUEPRINT.md`'s "Chart
conventions." 74 tests passing.

**Phase 6 + all 3 remaining data sources + salience layer** (2026-09-23
to 09-24, one extended session): built the Phase 6 evaluation framework
(`evaluation/` — benchmark suite, scorer, cost model, workload model;
not run live, no API key configured); built the salience/triage
reasoning layer (`intelligence/salience/selectNoteworthy.ts`) after a
question about why signal selection was always a fixed top-N rule;
wired the Federal Register API, CMS's MA/Part D Monthly Enrollment by
Plan file, and CMS's Marketplace Rate PUF — completing the full CMS
data-source priority order (Medicaid/T-MSIS stays deprioritized). Each
adapter's real, load-bearing findings (WA/CA/NY structurally absent from
the Marketplace file, undocumented 9999/0 sentinel values, named-entity
fields requiring adapter-level dropping) are recorded in
`SOURCE_REGISTRY.md` and each adapter's own header comment, not
duplicated here. Extracted shared `tukeyBox`/`quartiles` and CSV-parsing
utilities once a second real need existed for each. Also found and
fixed a real deploy gap: the whole Phase 1–5 build had been committed
locally but never pushed, so the dashboard had never actually been
live — fixed, and consolidated two overlapping portfolio cards into one
in the same pass. 121 tests passing, clean build, verified live on
adamdustin.me after every push.
