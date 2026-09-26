# Prompt Pack Manifest

## Start here (2026-09-25)

**Phases 1–6 are built and live, plus a 12th agent (Market/Catalyst
Intelligence) and a full round of dashboard-review fixes, all shipped
the same extended session.** The dashboard runs at
`/healthcare-intelligence`, live in production at adamdustin.me
(auto-deploys from `main` via Vercel — see `DEPLOYMENT.md`). Phase 6's
cross-provider evaluation is done (six models, 2026-09-25), and the
**autonomous monthly reasoning pipeline is built**
(`cms-intelligence/reasoning/`). Its API keys are GitHub Actions
repository secrets named per-project, `HEALTHCARE_INTEL_ANTH` and
`HEALTHCARE_INTEL_OAI` (added 2026-09-25). The workflow maps them onto
the standard `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` variables the code
reads; if either secret is missing, reasoning skips at $0.

**Resume here (end of 2026-09-25):** everything is pushed and live. Every
data source now uses full data, not a sample (steps 4-8). **Late
2026-09-25, a UI pass from Adam's annotated PDF of the live page** (layout
only, no agent or data changes):
- **Layout:** a new section order and a "Meet the team" section
  (`cms-intelligence/agents/teamRoster.ts`, whose test keeps it in sync
  with `ALL_AGENTS`). Each finding now appears once, in collapsible
  Category > Finding > Evidence menus.
- **Confidence** shows only inside the evidence drawer until snapshot
  history grows.
- **Charts:** vertical columns for three Data Explorer charts, and MA
  enrollment and Part B payment lines in place of the flat CR4 and
  facility-count lines. Chart rules are in DASHBOARD_BLUEPRINT.md's
  "Chart conventions".
- **Case study:** its data facts are now computed
  (`cms-intelligence/analytics/caseStudyFacts.ts`,
  `data/sources/sourceLabels.ts`), not hard-coded, so the monthly refresh
  keeps them true.
- **Later:** Adam plans a design-agent reskin (theme, colors, chart
  styling) near project completion. New UI uses existing tokens and
  placeholder avatars so that pass can restyle without touching layout. The live Executive Pulse shows the fixed ranking
because the data changed after the last reasoning run; per Adam, the
rerun waits for the next live test, the Oct 1 cron, or project
completion, whichever comes first. **Next, pick with Adam:**
- **Salience prompt fix: done and benchmarked 2026-09-25.** Both
  prompts in `intelligence/salience/selectNoteworthy.ts` now say to copy
  numbers exactly and never calculate new ones. On the rerun, 3 models
  were at 100% and 3 at 96%, up from 81-100%, and Opus and Sonnet no
  longer calculate numbers. Luna stays the salience model (details in
  MODEL_EVALUATION.md, "Rerun after the 'copy numbers exactly' prompt
  fix"). Run `evaluation/probe-providers.ts` (well under a cent) before
  any billed run to confirm every key and model answers.
- **Outlier detection for the analyst: built and replayed 2026-09-25.**
  The replay (one Opus call) had 0 rejections. It cited Arkansas's
  69.1% against the 21.7% median as an outlier, and read an empty list
  correctly ("no state stood apart"). The replay reuses the committed
  run's older insights, so it still quotes the pre-fix "AL, 330". The analyst now also gets states and service codes that
  sit far from the rest of their group in the latest period (rule and
  metrics in TREND_FRAMEWORK.md, "Cross-sectional outliers"; code in
  `intelligence/trends/outliers.ts` and `reasoning/outlierFacts.ts`).
  Its prompt has rules for them, grounding checks them, and each
  reasoned run saves them in `outlierFacts`. On the current data:
  - Physician metrics by state and home health spending: no state stands
    apart.
  - Benchmark premium, 2025 to 2026: Arkansas +69.1% against a 21.7%
    median; West Virginia's level ($1,093.95) against a $655.44 median.
  - Marketplace consumers: New Mexico +18.1% against a -6.0% median;
    new consumers up in Rhode Island and Mississippi against a -23.1%
    median.
  - Service codes, 2023 to 2024: 36 flagged. Top dollar moves are skin
    substitutes (Q4205 +$878.7M, Q4262 -$870.7M) and eye injections
    (aflibercept -$602.4M, faricimab +$481.3M).
- **Home health parsing bug: fixed 2026-09-25.** CMS writes episode
  counts of 1,000+ with commas, and `Number()` turned them into NaN, so
  the market-growth agent dropped 2,222 agencies holding 73% of all
  episodes. Its headline changes from "AL, 330 episodes per agency" to
  "NJ, 4,615". The fix is `parseNumericCell` in the home health adapter.
  The replay pattern in step 1 below ("high-volume home health states run
  above the 0.97 ratio") was built on the undercounted volumes; the next
  reasoned run replaces it. The evaluation suite keeps the old figure as
  a frozen task input.
- **Marketplace 2017-2019 open enrollment: added 2026-09-25.** A small
  xlsx reader (`data/adapters/xlsx.ts`, no new dependency) reads CMS's
  report workbooks. Each year keeps the 7 columns with a clear 2020+
  equivalent, and state rows sum exactly to CMS's platform totals. With
  history from 2017, the 2026 drop (-4.9%) now reads as in line with the
  2017-2025 pattern (median yearly change +9.0%), not a break: plan
  selections also fell in 2018, 2019 and 2020. 2015-2016 have no
  state-level file.
- **Medicaid: first source wired 2026-09-25.** Claim-level T-MSIS (TAF)
  needs a CMS data use agreement, so the Medicaid agent uses public data
  from data.medicaid.gov. First source: each state's monthly Medicaid and
  CHIP enrollment report (`cms:medicaid-state-enrollment`, June 2017 to
  June 2026, added to the monthly workflow). States file each month as
  preliminary, then final; preliminary runs lower, so comparisons never
  mix the two. Each state figure names its report month and status (the
  agent spec's per-state vintage rule). What it shows:
  - Enrollment fell 5.9% year over year to 73.17M (June 2026,
    preliminary), in 49 of 51 states; the peak was 94.66M in April 2023.
  - Adults fell 7.0% in expansion states and 2.4% in non-expansion states.
  - Indiana (-18.5%) and Louisiana (-14.0%) stand apart from the -3.8%
    median state; California lost the most people (1,650,639).
  Churn (Q057) has no current public source.
- **Rule (Adam, 2026-09-25): only data we can compare with current data.**
  A dataset that stopped updating stays off the dashboard. The Data
  Source & CMS Change Monitor watches it instead
  (`data/sources/watchlist.ts`, run monthly by
  `agents/source-change-monitor/check-watchlist.ts`). If one resumes, it
  writes `data/healthcare-intelligence/watchlist/status.json` and posts a
  warning on the Actions run; nothing is pulled automatically. Watched:
  the T-MSIS-derived monthly dual-status counts (latest December 2022;
  Q060).
- **Medicaid managed care by plan: added 2026-09-25** (`cms:medicaid-managed-care-plans`,
  annual 2016-2024, Q064). Only comprehensive managed care is counted,
  since people are counted once per program; Tennessee's dental and
  pharmacy plans listed inside its comprehensive program are excluded by
  name. Comprehensive enrollment fell 11.9% to 65.89M in 2024 across 42
  states (ND -33.6%, TX -28.6%, FL -26.8%). Parent names are as states
  report them and are merged only across spellings of one name, so
  company totals are understated (the finding says so). Centene leads
  with 6.97M in 20 states, -19.5%.
**After Oct 1:** check the monthly run's log. New steps (physician by
provider and by service, Marketplace rates and open enrollment) have
only run locally; physician steps should take seconds, NIH about 6
minutes, Marketplace rates about 10 seconds. Then review the first
reasoned run over the full data.

**Earlier steps, in order:**
1. **First live run reviewed; analyst prompt tuned and verified.** The first live autonomous run
   happened 2026-09-25 (hand-triggered, run 36166201308, bot commit
   `bf0aec2`, live on the Executive Pulse). Opus 5.5 returned 5 findings,
   3 patterns and a briefing, and grounding rejected 0 items: every number
   and company name traced to the agents' facts. Salience had no
   rejections either. The 4 "deterministic" selections are agents where
   candidates ≤ topN, which is by design. The review found three reasoning
   errors that grounding can't catch, because each one used real numbers
   and names:
   - ETCAMAH was grouped with the PRIORITY approvals, but it was STANDARD
     (an attribute attached to the wrong item).
   - "New-drug uptake will flow largely through Part D" is an unsupported
     inference. ISEMBYLD is an infused biologic and PIXCLARA is a PET
     agent.
   - A forced pattern paired 8-K leadership-change counts with enrollment
     share, and the briefing called the filings "frequent" for all four
     insurers, although Humana filed only 5.
   The analyst prompt now has rules against all three. A replay over the
   same run's facts (`npx tsx cms-intelligence/reasoning/replay-analyst.ts`,
   one Opus call, writes nothing) fixed all three with 0 rejections and
   no new errors. It kept 1 pattern instead of 3, a real one: high-volume
   home health states run above the 0.97 national spending ratio. Use
   the replay tool for any future prompt change.
   **No separate rerun for these three errors (Adam, 2026-09-25).** The
   live briefing still shows them. It gets corrected by whichever comes
   first: the next live agent test in a later phase, the Oct 1 cron, or a
   final rerun once the remaining work is complete.
2. **Salience prompt tightening: deferred.** The real run showed no
   salience rejections, so there is no live evidence for it yet. The
   benchmark note below still stands; revisit it if a monthly run logs
   fallbacks.
3. **Period comparisons for the analyst: built 2026-09-25.** Adam
   expected little month-over-month change, so the system doesn't fix one
   period length. Code computes month, quarter, half-year and
   year-over-year views for 7 dated metrics across the Federal Register,
   FDA, SEC and ClinicalTrials.gov, and marks each view notable or not
   (TREND_FRAMEWORK.md, "Choosing the period length"). The analyst names
   a shift only at the period length where one is notable. Each reasoned
   run saves these comparisons in `periodFacts`. On the current data:
   - CMS Federal Register documents: notable year-over-year (131 in
     2026-H1 vs 81 in 2025-H1) and month-over-month (14 in August vs 30
     in July).
   - Phase 3 results postings: notable at the half-year views only.
   - Everything else: steady.
   The trailing-12-month view starts at the Oct 1 pull, the first with 24
   complete months of data. **Still open:** the snapshot-level CMS sources
   (enrollment, hospitals, home health) have no dated history of their
   own, so they need monthly pulls to build up first. Their comparisons
   will need a level-based rule, because the Poisson count test doesn't
   fit them. Outlier detection was built later the same day (see "Next"
   above). The replay (Adam,
   2026-09-25) used the comparisons correctly: it led with the
   half-year Phase 3 decline and called final rules steady.
4. **Full-population summary tables: built and pushed 2026-09-25.**
   Adam asked whether the NIH and claims samples were hard API limits.
   They weren't. The limits were our own choices, mostly to keep
   committed snapshots small, never to save on model cost. Checking them
   also showed the physician "sample" was biased: the first 1,000 rows
   per state in API order, 560 providers with low-numbered NPIs. The
   system now pulls every record and summarizes it at pull time, and
   keeps the top-N lists alongside (SOURCE_REGISTRY.md, "Full-population
   summary tables").
   - Physician data: every Part B provider for 2013-2024.
   - NIH: all 140,718 awards in the window.
   - New claims-agent insights: a 12-year national payment trend split
     into volume and price, provider types whose growth broke from their
     own history, and state growth on standardized payment.
   - Reworked insights: the reimbursement agent's payment-to-charge
     benchmark now covers all providers nationally. The emerging-trends
     correlation covers the 50 states and DC (territories excluded)
     instead of 5 states. NIH totals and the
     by-institute split cover every award.
   - NIH monthly counts joined the period comparisons, marked seasonal.
   Pushing this changed the committed data, so the live Executive Pulse
   shows the fixed ranking until the next reasoning run. That's Adam's
   call (2026-09-25): no separate rerun now, wait for the next live test,
   the Oct 1 cron, or project completion. The new workflow steps have
   only run locally, so check the Oct 1 run's log: the physician step
   should take seconds (every year is cached) and NIH about 6 minutes.
   The Anthropic key leaked in chat on 2026-09-25 was revoked and the
   `HEALTHCARE_INTEL_ANTH` secret replaced the same day.
5. **MA/Part D monthly history: built and pushed 2026-09-25.**
   All 37 months CMS lists (2023-08 to 2026-09) are summarized by
   segment, parent organization and plan type. The MA agent gained three
   insights: the national enrollment trend, the year-over-year share
   shift by parent organization, and the plan-type mix shift (Q046,
   Q049). Year-over-year compares the same calendar month, because
   enrollment jumps every January. What the data shows:
   - MA growth is slowing: +2.6% to 35.97M in the year to 2026-09,
     after +3.8% the year before. Standalone Part D grew +8.2%.
   - January 2026: MA dipped month over month while standalone Part D
     rose 1.3M.
   - Humana gained 3.43 points of MA share (5.83M to 6.83M in January
     2026) and UnitedHealth lost 3.26 points (10.29M to 9.41M).
     UCare Minnesota left MA.
   - HMO share rose 3.66 points while PPOs fell.
   **Grounding limit found along the way:** as the facts carry more
   numbers, an invented number is more likely to match a real one by
   chance. A test's made-up "31.4%" now exists in the real data. The
   check still catches invented company names and most invented
   numbers, but it gets weaker as data grows. The analyst prompt's rules
   are the other line of defense.
6. **Service-level physician data: built and pushed 2026-09-25.**
   National Medicare Part B totals for every procedure code, 2013-2024
   (CMS's "by Geography and Service", national rows only: 3 requests a
   year), with CMS's RBCS service categories. Stored compactly, about
   7.7MB (the first version was 31MB). The totals match the provider data
   ($120.8B against $120.1B for 2024; the files suppress small cells
   differently). The claims agent gained three insights:
   - Growth by service category (Q011). Skin and soft tissue substitutes
     went from $3.58B to $8.08B in 2024, and from $0.03B in 2013.
   - Largest growth by individual service (Q012). Membrane-graft skin
     substitutes rose from $270M to $1.15B and faricimab (an eye
     injection) from $997M to $1.48B. 24 near-new services passed $50M
     in a year and are reported separately, because percentage growth
     from a near-zero base (a flu vaccine went from $0M to $291M) is
     meaningless.
   - Part B drug share: 10.7% of payment in 2013, 24.5% in 2024. This is
     also why the 2024 ophthalmology and ASC service counts jumped: drugs
     are counted in dose units (for example, aflibercept HD, new in 2024).
7. **Marketplace, every HealthCare.gov state, 2014-2026: built and pushed 2026-09-25.**
   The Rate PUF is now joined to the Plan Attributes PUF and summarized
   per plan year (about 55KB a year). The 5-state sample it replaced was
   wrong in three ways:
   - About 10,800 of its 14,200 rows were stand-alone dental plans (under
     $50), so the live "median premium" was mostly a dental premium, and
     its issuer counts included dental issuers.
   - Its "No Preference" tobacco filter dropped every tobacco-rated plan,
     about half of all plans.
   - It mixed in small-group rates effective later in the year.
   The $0 and $9,999 rates it excluded as an "empirical judgment" were all
   dental and small-group rows; no individual medical rate has either
   value in any year.
   The agent now reports four insights:
   - Benchmark (second-lowest silver, age 40) trend, Q067: +21.7% for
     2026 in the median state, rising in 28 of 30, which breaks from the
     2014-2025 pattern. The history matches the published record: +22.8%
     in 2017, silver +39.5% vs bronze +16.9% in 2018 (silver loading),
     declines 2019-2022.
   - Benchmark change by state, Q067: Arkansas +69.1%, South Dakota
     -5.4%; West Virginia highest at $1,094 a month.
   - Deductibles, Q069: median silver deductible $5,925, +$900 from 2025;
     $2,500 in 2014.
   - Issuer participation, Q071: 22 exits and 10 entries for 2026;
     state-issuer pairs fell from 187 (2025) to 175, against a low of 87
     in 2018.
   The federal files only cover HealthCare.gov states (30 for 2026); 20
   states and DC run their own exchanges. Every comparison uses only
   states present in the years compared. The Data Explorer shows the 5
   fastest-rising states' benchmark since 2014 as a line chart.
8. **Marketplace enrollment, every state and DC, 2020-2026: built and
   pushed 2026-09-25.** CMS's Open Enrollment state-level files
   (`cms:marketplace-oep-state`) cover state-run exchanges too, and
   answer Q066. 2017-2019 exist only as Excel report workbooks and are
   skipped. CMS labels state-run exchanges "SBM" in 2021-2024 and "SBE"
   otherwise; both are stored as SBE. What the data shows:
   - Plan selections doubled from 11.41M (2020) to 24.32M (2025), then
     fell 4.9% to 23.13M for 2026, breaking from the pattern, and fell
     in 41 of 51 states. New consumers fell 12.7%.
   - The enrollment-weighted average premium after subsidy rose from
     $113 to $178 a month (+58%), consistent with the enhanced premium
     tax credits expiring.
   - North Carolina fell most (-21.9%, 213,653 fewer), then Ohio
     (-19.5%); New Mexico rose 18.1% and Texas 5.2%.
   - Across states, larger after-subsidy increases went weakly with
     larger enrollment losses (r = -0.29, just past the 0.27 threshold
     for 51 states).
9. **Salience benchmark note.** Every rejected salience answer
   in the benchmark was a model calculating a number itself (day spans,
   counts, sums). Telling the salience prompt "copy numbers exactly, never
   calculate new ones", as the analyst prompt already does, would likely
   raise acceptance for every model. **Done 2026-09-25** (see "Next"
   above); the benchmark rerun to confirm it is still pending.

Model choices, costs, and all evaluation evidence: `MODEL_EVALUATION.md`.

**What's real:**
- **10 data sources wired**: the original 6 CMS-focused sources (all 3
  items on Adam's CMS priority order are done) — Hospital General
  Information, Home Health Care Agencies, Medicare Physician & Other
  Practitioners (5-state sample), the Federal Register API (CMS filter),
  CMS's MA/Part D Monthly Enrollment by Plan file, and CMS's Marketplace
  Rate PUF — plus 4 non-CMS sources added 2026-09-24 for the
  Market/Catalyst Intelligence agent: SEC EDGAR 8-K filings (6-company
  health-insurer watchlist), openFDA novel drug approvals, NIH RePORTER
  award notices, and ClinicalTrials.gov Phase 3 results postings. The
  Federal Register feed and all 4 Market/Catalyst sources use a
  live-verified 730-day (2-year) rolling window (widened the same day
  from an original 120-150 days per Adam's request - see the History
  entry below for the real per-source feasibility check behind this).
  Full detail, verification method, and known limitations for each:
  `SOURCE_REGISTRY.md`. Medicaid/T-MSIS is the only named CMS source left
  unwired — deliberately deprioritized as most fragmented.
- **9 of 12 domain agents produce real, evidence-backed insights**
  (Market Growth ×2, Claims/Utilization/Cost, Reimbursement & Payment,
  Provider & Network ×up to 7 (Q036/Q038 ownership-concentration,
  Q042/Q043 facility entries/exits, Q125-Q128's star-rating/quality-
  outcome signals), Emerging Trends, Policy/Regulation/CMS ×3, MA/Part D
  ×2, Commercial/Marketplace ×2, and Market/Catalyst Intelligence ×up to
  13). Medicaid/CHIP/Duals is the one remaining honest stub among the
  original 11. 2 agents are infrastructure-only (Source Monitor, Data
  Architecture). All 7 dashboard layers have at least one real finding
  (Market/Catalyst's Q113-Q124/Q129 and Provider & Network's Q125-Q128
  both fold into existing layers — Emerging Signals and Provider &
  Network respectively — rather than adding new ones).
- **12th agent: Market/Catalyst Intelligence** (`agents/market-catalyst/`,
  Q113-Q124, Q129) — a new question category beyond the original
  112-question catalog, tracking real corporate-disclosure (SEC 8-K),
  drug-approval (openFDA), federal-grant (NIH RePORTER), NIH
  research-theme frequency (Q129, added 2026-09-24), and
  clinical-trial-results (ClinicalTrials.gov) activity. The third real
  use of the revised carrier-naming rule (see `AGENT_ARCHITECTURE.md`
  §13). Real, disclosed corrections made during implementation (not
  papered over): NIH RePORTER's real `agency_code` field turned out to be
  the sponsoring HHS operating division, not NIH institute-level detail,
  as originally planned — the agent's Q115 insight is honestly relabeled
  for this. "Grants rescinded" was researched and found infeasible with
  any free/verifiable public source and was deliberately not built — see
  `DATA_GAP_REGISTER.md` §8.
- **Star rating vs. quality outcomes (Q125-Q128) and facility
  entries/exits (Q042/Q043)**, both added 2026-09-24, owned by Provider &
  Network on the already-live Hospital General Information dataset — per
  Adam's dashboard feedback. A real scatter plot (Q125, `ChartScatter`
  chart type) correlating CMS's overall star rating against a real net
  quality-outcome score derived from the same dataset's mortality/safety/
  readmission measure-group counts (Pearson r = 0.56 as of the first real
  pull — moderate-to-strong positive, disclosed as correlation, never
  causation); Tukey boxplots of star rating (Q126) and net
  quality-outcome score (Q127) by state; a states-improving-over-time
  check (Q128); and real facility-entry/exit tracking (Q042/Q043) via the
  same `diffRows()` mechanism the Data Source & CMS Change Monitor agent
  uses. As of 2026-09-24 both Q128 and Q042/Q043 honestly report no
  persistent change/entries/exits observed yet (this CMS dataset
  refreshes quarterly; only ~1 week of real history exists so far),
  alongside real current-snapshot rankings. New shared
  `pearsonCorrelation()` in `intelligence/metrics/metrics.ts`,
  `ScatterChart.tsx` and `ListChart.tsx` components.
- **Salience/triage reasoning layer**
  (`cms-intelligence/intelligence/salience/selectNoteworthy.ts`): splits
  real fact computation (stays deterministic) from selecting/explaining
  which real candidates matter this cycle (a narrow LLM step that can
  only choose among and explain given candidates, never invent one).
  Falls back to the prior deterministic top-N ranking whenever no model
  is configured (true today — zero behavior change, zero cost by
  default). Runs in 8 of the 9 real agents as of 2026-09-24: MA/Part D,
  Marketplace, and Market/Catalyst from the start, then retrofitted into
  Market Growth, Claims/Utilization/Cost, Reimbursement & Payment,
  Policy/Regulation/CMS, and Provider & Network (verified byte-identical
  no-model output before/after). Emerging Trends is the one real agent
  without it, deliberately — its single insight is one correlation value,
  not a ranked candidate list. Headline claims like "largest"/"most
  recent"/"best" are always computed from the full real ranking, never
  from the selection; Policy's selections use `direction: "lowest"`
  (fewest days since publication / until effective). CR4 in Provider &
  Network is deliberately NOT routed through it (definitionally the top
  4 by count).
- **Naming-privacy pattern, revised 2026-09-24**: MA/Part D and
  Marketplace source files both name a real carrier/plan on every row.
  The rule is no longer "drop every named field unconditionally" — a real
  carrier name may reach an insight when it's a genuine, sourced finding
  computed from real data (e.g. MA/Part D's parent-organization enrollment
  ranking, the kind of reading a real industry directory like AIS Health
  publishes), never fabricated or implied-proprietary. MA/Part D's adapter
  now keeps `parentOrganization`/`organizationMarketingName` for exactly
  this. Marketplace's IssuerId - previously dropped entirely - is now
  kept as of 2026-09-24 too, but only ever used as a real COUNT of
  distinct issuers per state (Q071's competitive-intensity read), never
  surfaced or resolved to a company name - it's still an opaque numeric
  ID with no verified name crosswalk wired in (see `SOURCE_REGISTRY.md`).
- **Phase 6 evaluation: run live across six models, 2026-09-25**
  (`cms-intelligence/evaluation/`). Corrected scores: Opus 5.5 0.92,
  Sonnet 5 0.85, then Haiku 4.5, GPT-6 Sol, gpt-4o-mini and GPT-6 Luna
  within noise at 0.68-0.74. Every model refused unanswerable questions
  and disclaimed scope correctly. Three measurement bugs were found and
  fixed on the way (output truncation, negated phrases counted as
  forbidden claims, correct refusals not recognized); see
  `MODEL_EVALUATION.md`.
- **Autonomous monthly reasoning** (`cms-intelligence/reasoning/`, built
  2026-09-25, live once API-key secrets are added):
  1. Data pulls monthly (free).
  2. A content-fingerprint gate skips all model calls if nothing changed.
  3. Every agent re-runs with `gpt-6-luna` doing salience picks.
  4. An executive analyst on `claude-opus-5-5` ranks what matters to a
     healthcare leader and connects findings across domains.
  5. Every model-written number and insurer name must trace to real
     computed facts or it's dropped (`grounding.ts`).
  6. The run commits straight to `main` (Adam's decision: no review
     step), and the dashboard shows it only while it matches the
     committed data.

  About $1/year.
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
- Monthly data-pull cadence as of 2026-09-25, previously quarterly; data
  pulls are free, and any LLM reasoning stays gated on real new data
  (`COST_AND_OPERATING_MODEL.md`).
- ~~Hard deadline: the initial LLM-synthesis backfill must complete
  before 2026-11-04.~~ **Withdrawn 2026-09-25**: that $100 credit is
  Claude Code cloud-session credit, not Developer Platform API credit, so
  it never funded this project's API calls (see
  `COST_AND_OPERATING_MODEL.md`'s correction). API spend is billed
  normally and is tiny at measured rates.
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

**12th agent: Market/Catalyst Intelligence** (2026-09-24, same extended
session): added a new question category (Q113-Q124, beyond the original
112) and 4 brand-new non-CMS real data sources — SEC EDGAR 8-K filings
(6-company health-insurer watchlist), openFDA novel drug approvals, NIH
RePORTER award notices, and ClinicalTrials.gov Phase 3 results postings,
each on a 150-day rolling window and each independently verified live
before being wired in. Real corrections made during implementation (not
papered over): NIH RePORTER's real `agency_code` field turned out to be
the sponsoring HHS operating division (NIH/FDA/ALLCDC), not NIH
institute-level detail (NHLBI/NCI/NIA) as originally planned — the
by-agency insight was honestly relabeled rather than left mislabeled;
openFDA's search-matches-at-application-level behavior required
per-submission re-filtering after the initial fetch; NIH RePORTER's
real response shape ignores the requested PascalCase field names and
always returns its own snake_case/nested shape; ClinicalTrials.gov v2's
response nests every requested field under its real module rather than
returning flat keys. "Grants rescinded" was researched as a possible 5th
source and found infeasible with any free/verifiable public source
(negative USAspending grant obligations are routine entitlement
true-ups, not rescissions) — deliberately not built, logged in
`DATA_GAP_REGISTER.md` §8 instead. 163 tests passing (28 test files),
clean `tsc`/`lint`/build.

**Star rating vs. quality outcomes** (2026-09-24, same extended session,
per Adam's PDF-annotated dashboard feedback): added Q125-Q128 to Provider
& Network on the already-live Hospital General Information dataset — no
new data source needed. New `ChartScatter` chart type and
`ScatterChart.tsx` component (single hue, low-opacity points so real
overlapping star-rating clusters read as density rather than illegible
stacking), plus a new shared `pearsonCorrelation()` metric. Real,
verified finding: star rating and a real net quality-outcome score
(derived from the same dataset's mortality/safety/readmission
better/worse counts) correlate at r = 0.56 (moderate-to-strong positive)
across 2,961 real hospitals — explicitly documented as correlation, not
causation, since the star rating is partly derived from these same
measure groups. The states-improving-over-time question (Q128) honestly
reports no state has yet shown a persistent real improvement, since this
CMS dataset refreshes quarterly and only ~1 week of real snapshot history
exists so far — not a system limitation, and not papered over with a
fabricated trend. 171 tests passing (28 test files), clean
`tsc`/`lint`/build/e2e.

**Dashboard feedback response** (2026-09-24, same extended session, per
Adam's review of the localhost build): a batch of real bug fixes, one
genuinely new agent capability, and a live-verified feasibility finding.
- **Real label-clipping bug fixed**: `BarChart.tsx`'s label-column width
  had a leftover 180px hard cap that clipped real long labels (e.g. the
  50-character "BlueCross BlueShield Association, Federal Employee") at
  the SVG's own left edge - contradicted this file's own "compute from
  the actual longest label, never a fixed guess" rule. Cap removed.
- **Marketplace plan-availability insight (Q071) redesigned**: the prior
  rating-area-level distinct-plan-count ranking was a real degenerate
  tie (9 South Carolina rating areas tied at exactly 27 - issuers file
  consistently across every rating area they enter within a state, so
  rating area carries no real signal). Redesigned to state-level
  distinct-issuer count (real IssuerId field, added to the adapter - see
  naming-privacy note above), which shows genuine variation (7 to 18
  issuers across the 5 sampled states) and better matches Q071's own
  catalog wording ("number of issuers/plans").
- **Upcoming-finalized-CMS-rules insight (Q076) redesigned**: was a bar
  chart keyed by opaque document numbers; a bar chart doesn't convey
  "what are these rules and where do I read them." New `ChartList` chart
  type (`ListChart.tsx`) - a real linked bullet list, each item the
  rule's real title, real effective date, and a real Federal Register
  URL.
- **"Obvious correlation" insight redesigned** (emerging-trends agent,
  Q088): facility-count-vs-physician-payment was mechanically expected
  (more facilities → more physicians needed), so a positive correlation
  there confirmed nothing new. Redesigned to hospital ownership
  concentration (CR4, reused from Provider & Network's own `cr4For`) vs.
  physician payment - a real market-power question with no definitional
  link, honestly reporting a weak r = 0.25 rather than a stronger but
  meaningless result.
- **NIH research themes (Q129, new)**, per Adam's request: added NIH
  RePORTER's real `terms` field to the adapter and re-pulled live. Real
  finding at the initial 150-day pull: raw term frequency is dominated by
  generic grant-administration language ("Research" in 85/100 sampled
  awards) - a documented, disclosed statistical band (3 to 20% of sample)
  excludes that noise; within the band, a real, genuine concentration
  emerged that pull (Alzheimer's Disease and Related Dementias
  terminology across ~19-20% of sampled awards). This is a real,
  dynamically computed top-100-by-dollar sample, not a fixed result - a
  later re-pull with the 2026-09-24 window-widening below drew a
  different top-100 sample from a much larger real population and
  surfaced a different leading in-band term ("Scientist", still real and
  correctly computed, just less narratively clean) - expected behavior
  given the sample changed, not a bug. Near-synonymous NIH phrasings are
  never merged in either case - disclosed as a real limitation, not
  hidden.
- **Facility entries/exits (Q042/Q043, new)**, per Adam's request for
  closure/opening tracking: two pre-existing catalog questions Provider &
  Network already owned but had never built, implemented via the same
  real `diffRows()` mechanism the Data Source & CMS Change Monitor agent
  uses. Honestly reports zero real entries/exits across the 3 real pulls
  collected so far (same real quarterly-cadence reasoning as Q128).
- **2-year historical window, feasibility-verified, not assumed**: per
  Adam's request for "quarters over the last two years" instead of the
  original ~150-day windows. Live-verified finding: CMS's own Provider
  Data Catalog datastore API exposes only the CURRENT dataset vintage -
  no historical-vintage parameter exists (checked directly against the
  real metastore), so the CMS-sourced series (hospital counts, MA/Part D
  enrollment, Marketplace rates) cannot be retroactively backfilled -
  only accumulate forward from each future real pull, as already
  designed. The 4 market-catalyst sources plus Federal Register, by
  contrast, expose real historical date-range queries - all 5 were
  widened from ~120-150 days to a real, live-verified 730-day (2-year)
  window: openFDA's single-request cap raised (100→1000, verified 607
  real matching applications / 105 real matching submissions over 2
  years, safely under the new cap); ClinicalTrials.gov gained real
  pagination (its documented `nextPageToken`, verified 1,706 real
  matching studies over 2 years, well past one page); NIH RePORTER and
  SEC EDGAR needed only the window constant changed (their existing
  designs already covered the wider real population safely). Federal
  Register's per_page cap was also raised (250→1000, verified 487 real
  matching documents in one request).
- **LinkedIn/social link preview** (`app/opengraph-image.tsx`, new; Next's
  file-convention metadata API), per Adam's request for a rich preview
  when adding this site to a LinkedIn Featured section - a real
  dynamically-rendered branded PNG, plus `openGraph`/`twitter` metadata
  fields in `app/layout.tsx` (`metadataBase` set so the image URL
  resolves absolutely, required for external crawlers like LinkedIn's).
- 175 tests passing (28 test files), clean `tsc`/`lint`/build/e2e.

**Salience-layer retrofit** (2026-09-24, same extended session): routed
the remaining fixed top-N selections in Market Growth, Claims/Utilization/
Cost, Reimbursement & Payment, Policy/Regulation/CMS, and Provider &
Network through `selectNoteworthy()` — 8 of 9 real agents now use it.
Verified as a true zero-visible-change refactor: the full no-model output
of all 5 agents (plus the Data Explorer overview) was snapshotted before
the change and compared byte-for-byte afterwards — identical. Every
"largest"/"most recent"/"best" headline claim is computed from the full
ranking, never from the selection, so it stays true whatever a model
picks. Policy's rule lists use `direction: "lowest"` (recency/proximity
is the signal). CR4 deliberately stays outside the layer (it's
definitionally the top 4). Measured: a full sweep with a model configured
would make 16 salience calls + 1 synthesis call. 186 tests passing (28
test files; each retrofitted agent gained a model-path test and an
invented-id fallback test via `intelligence/salience/testProviders.ts`),
clean `tsc`/`lint`/build/e2e.

**First live Phase 6 evaluation run** (2026-09-25). *Correction, same
day: the two "real scoring failures" below were scorer bugs, not model
behavior. Every model wrote "not the full national file" and every model
refused the site-of-care question. See the six-model entry below.*
`run-live-evaluation.ts`
run for real, for the first time, with a fresh OpenAI key set as a local
shell env var only (never committed, never a repo secret). Real result
through `openai:gpt-4o-mini`: mean score 0.59/1.0, 100% schema
compliance, real measured cost $0.00027/question (~$0.003 for the full
12-task suite) — confirms `costModel.ts`'s estimate rather than just
testing it. Two real scoring failures worth noting, not swept under the
aggregate: the reimbursement-change task tripped a forbidden-claim flag
("full national" claimed against what's actually a real 5-state sample),
and the site-of-care-change task appears to have fabricated an answer
where a refusal was expected. No `ANTHROPIC_API_KEY` was used this run,
so this is one provider's real numbers, not yet the cross-provider
comparison Phase 6's acceptance criterion describes — see
`MODEL_EVALUATION.md`'s "Live run results" section for full detail. Real
output committed at
`data/healthcare-intelligence/evaluation-runs/2026-09-25-*`.

**Six-model evaluation and autonomous monthly reasoning** (2026-09-25,
same session):

*Evaluation.* Ran the benchmark live through Claude Haiku 4.5, Sonnet 5
and Opus 5.5 and through gpt-4o-mini, GPT-6 Luna and GPT-6 Sol. Reading
the raw answers turned up three measurement bugs:
- The 400-token cap truncated Opus mid-answer.
- Negated phrases ("not the full national file") were counted as
  forbidden claims.
- The refusal detector missed common phrasings and curly apostrophes.

After fixing all three and re-scoring the saved answers for free
(`rescore.ts`): Opus 0.92, Sonnet 0.85, the rest 0.68-0.74. Every model
behaved safely. The scorer now has its first tests, built from the real
mis-scored answers.

*Autonomy.* Per Adam: data pulls went from quarterly to monthly, the
monthly run now reasons autonomously, and it publishes straight to `main`.
New `cms-intelligence/reasoning/`:
- **Change gate:** content fingerprints, so a month with no new data
  makes no model calls.
- **Executive analyst:** ranks what matters, finds cross-domain patterns,
  and writes a briefing.
- **Grounding check:** also applied to the existing salience rationales
  and synthesis, since all of it now publishes unreviewed.
- **Monthly run and workflow step:** `continue-on-error`, so a model
  failure can't block the free data commit.
- **Dashboard:** shows a reasoned run only while its fingerprints match
  the committed data.

Routing is from measured results: `gpt-6-luna` for cheap picks,
`claude-opus-5-5` for the one analyst call. `CLAUDE.md`'s model guardrail
and `ROADMAP.md`'s confirm-before-write guardrail were updated to record
both decisions. The "$100 credit / Nov 4 deadline" premise was also
corrected: it's Claude Code cloud-session credit, not API credit.
API keys are repository secrets `HEALTHCARE_INTEL_ANTH` and
`HEALTHCARE_INTEL_OAI`, mapped in the workflow onto the standard variable
names.

**Salience benchmark** (2026-09-25, same session): tested all six models
on the 16 real salience prompts production sends, judged by production's
own acceptance rule (`salienceBenchmark.ts`, `run-salience-evaluation.ts`).
GPT-6 Luna was accepted 100% of the time at about $0.006 per monthly run,
which confirms it as the salience model by measurement rather than
inference.

Fixes the benchmark prompted:
- **Thinking effort per call.** Sonnet 5 and Opus 5.5 think by default and
  had exhausted the output cap: low for salience and synthesis, high for
  the analyst, and never sent to Haiku, which rejects it.
- **Larger output caps.**
- **Grounding accepts abbreviations** such as "$109.4M".
- **Re-scoring:** `rescore.ts` now also re-scores salience runs for free.
