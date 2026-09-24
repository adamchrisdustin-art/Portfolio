# Agent Architecture — Healthcare Intelligence Executive Dashboard

Phase 2 deliverable per `02_PHASE_2_INTELLIGENCE_BLUEPRINT.md` §2. Defines
responsibilities, inputs, outputs, dependencies, and escalation rules for
each of the 12 agents named in `00_MASTER_ORCHESTRATOR.md`.

Directory home for all of this: `cms-intelligence/agents/<agent-slug>/` per
`PROJECT_BOUNDARY.md`. Implementation (Phase 3) is not started here — this
is the design each agent's eventual instruction file must match.

## Cross-cutting rules (apply to every agent below, not repeated per agent)

- **Deterministic-first.** Per `00_MASTER_ORCHESTRATOR.md` and
  `COST_AND_OPERATING_MODEL.md`: aggregation, normalization, rates, rolling
  averages, trend math, thresholding, anomaly detection, joins, provenance,
  and validation are all code, not LLM calls. LLM calls are reserved for
  research, synthesis, interpretation, narrative, and cross-source
  reasoning — see each agent's own "LLM vs. code" split below.
- **Cost gate.** No agent runs its LLM step unless agent #11 (Data Source &
  CMS Change Monitor) has already found a material change upstream, or the
  agent is being run in an interactive/on-demand review context. This is
  the same shape as `pipeline/analystAgent.ts`'s `hasMaterialChange` gate,
  applied uniformly — see `COST_AND_OPERATING_MODEL.md`.
- **No fabrication.** No agent may invent a source, invent a number, state
  causality without evidence, use a source outside its stated population
  without labeling the mismatch, or use stale data without labeling it —
  per `08_AGENT_PROMPT_TEMPLATE.md`'s evidence rules, binding on all 12.
- **Real company naming, revised 2026-09-24.** A real carrier (e.g.
  UnitedHealthcare, Optum, Humana) may be named in an insight or published
  copy ONLY when it is a genuine, sourced finding computed directly from
  real public data (e.g. a market-share/enrollment ranking, the same kind
  of reading a real industry directory like AIS Health publishes) — never
  fabricated, never implied to be this project's own proprietary/internal
  data, and never used to editorialize about a carrier beyond what the
  cited number shows. Wherever the underlying question doesn't need a real
  name to answer it, category-level aggregation (generic descriptors like
  "a national health insurer") stays the default. Original tighter rule
  (never name a real carrier anywhere) flagged per Adam's 2026-09-23
  direction; revised the following day per Adam's clarification that the
  intent was always "no claim of proprietary access," not "no real name
  ever" — see project memory.
- **Structured output, always.** Every agent that produces a finding emits
  it as an `Insight` object matching `EVIDENCE_MODEL.md`'s schema — never
  free text alone. Narrative is a field *inside* the structured object, not
  a replacement for it.
- **Confidence and signalType are computed, never hardcoded.** Added as a
  Phase 5 addendum (2026-09-23) after the first three data-backed agents
  briefly shipped with `persistenceMet`/`hasFullBaseline` hardcoded to
  `false`. Any agent reading from a source with more than one real
  snapshot must use `cms-intelligence/data/sources/snapshotHistory.ts`
  (`assessSnapshotHistory`, `directionsAcrossSnapshots`) together with
  `intelligence/trends/trend.ts`'s `classifyConfidence`/`meetsPersistence`
  to derive `confidence` and `signalType` from the *actual* accumulated
  history — not assume "low"/"baseline" forever. See
  `agents/market-growth/agent.ts`, `agents/provider-network/agent.ts`,
  and `agents/claims-utilization-cost/agent.ts` for the reference
  implementation. This is exactly why every real insight currently shows
  low confidence: it's genuinely true (days of history, not the required
  24-month window), and will correctly update on its own as real history
  accumulates — no code change needed when that happens.
- **Populate `Insight.series` when real multi-point history exists.**
  Added the same addendum. When a source has 2+ real snapshots, build an
  `InsightSeries` (see `EVIDENCE_MODEL.md`) from the real per-snapshot
  values so the dashboard can render an actual chart
  (`components/Sparkline.tsx`) — never fabricate or interpolate a point
  for a date with no real pull. Omit the field entirely when fewer than
  2 real snapshots exist.
- **Escalate, don't guess.** Every agent escalates to the Executive
  Orchestrator (agent #1) when: data conflicts, required data is missing,
  the result is highly uncertain, another domain is required, or the issue
  appears strategically material. "Escalate" means the agent returns an
  explicit `insufficient_evidence` or `needs_other_domain` result — it
  never fills the gap with speculation.

---

## 1. Executive Orchestrator

**Mission:** delegate to the 11 specialist agents, resolve conflicts between
their outputs, and synthesize a coherent executive narrative — the only
agent that talks to more than one other agent directly.

**Executive questions owned:** Q108–Q112 (Executive strategy category) —
"what materially changed," "what should leadership investigate," "what
should leadership stop assuming."

**Inputs:** structured `Insight` objects from all 11 domain/support agents;
the prior refresh cycle's stored dashboard state (for Q108's diff).

**Outputs:** a ranked list of `Insight` objects for the Executive Pulse
dashboard layer, each carrying its originating agent's `source_ids` intact
(the Orchestrator synthesizes and ranks, it does not re-derive evidence).

**Dependencies:** all other 11 agents, run after them each cycle.

**LLM vs. code split:** ranking/materiality thresholding is code (a defined
scoring function against confidence + business relevance + freshness);
narrative synthesis across multiple agents' findings into one executive
read is the LLM step, and only runs on findings that already cleared the
cost gate upstream.

**Implementation note (Phase 5 addendum, 2026-09-23):** the live
dashboard's Executive Pulse layer previously just listed cards with no
actual synthesis step — Adam noticed the agents weren't visibly "working
together." Fixed by extracting the synthesis logic into
`agents/orchestrator/synthesis.ts`, shared between `orchestrator.ts`
(per-question queries) and `fullSweep.ts` (the dashboard's full sweep,
which now also returns a real `synthesis` string, rendered at the top of
Executive Pulse). Falls back to a rule-based summary when no
`ModelProvider` is configured, same as every other synthesis step in
this system.

**Escalation:** has nowhere further to escalate *to* — it is the top of the
chain. Its own "escalation" is surfacing a `needs_human_review` flag on the
dashboard rather than a downstream agent call, for the Q109/Q110/Q111
class of self-critical questions that materially depend on human judgment.

---

## 2. Market Growth & Geographic Intelligence

**Mission:** answer where and how fast markets are growing, using
enrollment, utilization, and provider-capacity signals together.

**Executive questions owned:** Q001–Q010 (Market & Growth).

**In scope:** geography-level growth/acceleration/divergence analysis
across enrollment, utilization, and provider-capacity datasets.

**Out of scope:** *why* a market is growing at the claims-detail level
(delegates to Claims/Utilization/Cost) or at the policy level (delegates
to Policy/Regulation/CMS Programs).

**Inputs:** CMS Monthly Enrollment, provider enrollment/capacity data,
utilization aggregates from the Claims/Utilization/Cost agent's processed
output (not raw claims — this agent doesn't re-derive utilization itself).
**Second Phase 5 addendum (2026-09-23):** also reads CMS Home Health Care
Agencies directly (all states, not the 5-state physician sample) for a
state-level capacity/investment signal — episodes-per-agency (a real
utilization/demand proxy derived from the dataset itself, since no
external population/eligible-beneficiary source is wired) ranked among
states with above-median quality and spending efficiency near the CMS
benchmark. Added after Adam asked for exactly this kind of "which care
settings are worth investing in" read; deliberately built as an
auditable, component-by-component baseline rather than a black-box
opportunity score, and explicitly not a demand-*growth* claim since
there's no true population denominator behind it yet.

**Outputs:** `Insight` objects tagged to Q001–Q010, geography-keyed.

**Dependencies:** Claims/Utilization/Cost agent (for utilization input),
Provider/Network agent (for capacity input), Data Architecture agent (for
the semantic model that keeps geography keys consistent across sources).

**LLM vs. code split:** growth rate, acceleration, and divergence
calculations are code (see `METRIC_DICTIONARY.md`/`TREND_FRAMEWORK.md`);
narrating *which* markets deserve executive attention and why is the LLM
step.

**Escalation:** escalates to Provider/Network when a growth signal appears
driven by a single large ownership change rather than organic growth (needs
that agent's ownership-change context to disambiguate).

---

## 3. Claims, Utilization & Cost Intelligence

**Mission:** decompose utilization and cost trends into volume/price/
intensity/mix components and track site-of-care shifts.

**Executive questions owned:** Q011–Q025 (Claims & Utilization).

**In scope:** Medicare FFS claims-derived utilization and cost analysis at
the service/category level; volume-price-intensity-mix decomposition;
site-of-care shift detection.

**Out of scope:** payment-rate-setting mechanics (delegates to
Reimbursement); MA/Medicaid/Marketplace-specific utilization patterns
(delegate to their respective agents, this agent's population is FFS by
default per the catalog's Dimensions block).

**Inputs:** Medicare Physician & Other Practitioners, Medicare Inpatient,
Medicare Outpatient, Hospital Service Area datasets.

**Outputs:** `Insight` objects tagged to Q011–Q025; also the "utilization
aggregates" the Market Growth agent consumes as an input.

**Dependencies:** Data Source & CMS Change Monitor (upstream gate), Data
Architecture agent (semantic model for service/category definitions).

**LLM vs. code split:** the volume/price/intensity/mix decomposition
itself is code (a defined, reproducible formula — see
`METRIC_DICTIONARY.md` "growth"); identifying *which* clinical/market
story plausibly explains a decomposition result is the LLM step, always
labeled as an interpretation, not a fact.

**Escalation:** escalates to Reimbursement when a cost-growth signal's
price component looks driven by a rate-schedule change rather than market
dynamics (needs that agent's rule-cycle context).

---

## 4. Reimbursement & Payment Intelligence

**Mission:** track CMS payment methodology changes and their exposure by
specialty, procedure, and facility type — forward-looking by design.

**Executive questions owned:** Q026–Q035 (Reimbursement).

**In scope:** proposed/final rule tracking, fee-schedule/rate-change
monitoring, specialty/procedure/facility exposure analysis.

**Out of scope:** the claims-level confirmation of whether a payment
change actually showed up in utilization/cost (delegates back to Claims/
Utilization/Cost, which owns Q035's lagging-indicator side).

**Inputs:** Medicare Physician Fee Schedule, IPPS/OPPS final rules,
Federal Register, regulations.gov. **Phase 5 addendum (2026-09-23):**
also real, live-pulled data — CMS Medicare Physician & Other
Practitioners by Provider and Service (see
`cms-intelligence/data/adapters/physicianOtherPractitioners.ts`),
providing a real "external reimbursement benchmark" (submitted charge
vs. actual Medicare payment, by provider type) even before rule-change
tracking exists. This is the first real content in this agent — added
after Adam pointed out the Reimbursement layer was empty on the live
dashboard despite being named in the Phase 2 blueprint.

**Outputs:** `Insight` objects tagged to Q026–Q035, explicitly flagged
`proposed` vs. `final` (this agent enforces the master orchestrator's
"never represent proposed policy as final" rule structurally, not just
by convention — the schema itself carries a status field for this) once
rule tracking exists. Today's real output is tagged Q031, a `baseline`
payment-vs-charge benchmark by provider type — see
`agents/reimbursement-payment/agent.ts`.

**Dependencies:** Policy/Regulation/CMS Programs agent (shares the same
rule-tracking source family — this agent focuses on the payment-mechanics
subset, Policy owns the broader program/regulatory subset).

**LLM vs. code split:** rule-text parsing for effective dates and stated
impact tables is largely code/structured extraction; interpreting *why* a
change matters to a given specialty/facility audience is the LLM step.

**Escalation:** escalates to Market Growth or Provider/Network when a
payment change's exposure list overlaps materially with a market/provider
signal already being tracked there.

---

## 5. Provider & Network Intelligence

**Mission:** track provider/facility growth, contraction, concentration,
ownership change, and entry/exit — the supply side of the market story.

**Executive questions owned:** Q036–Q045 (Provider & Network).

**In scope:** provider/facility-count trends, ownership-change tracking,
concentration-ratio calculation, ASC-specific expansion tracking.

**Out of scope:** value-based-care-specific provider behavior (delegates
to a shared signal with the Policy agent for Q107's VBC/concentration
intersection question, rather than owning VBC outright).

**Inputs:** CMS Provider Enrollment public files, Provider ownership
dataset, Hospital General Information, ASC datasets.

**Outputs:** `Insight` objects tagged to Q036–Q045; also the "capacity
input" the Market Growth agent consumes.

**Dependencies:** Data Source & CMS Change Monitor, Data Architecture
agent.

**LLM vs. code split:** concentration ratios, entry/exit counts, and
growth/decline classification are code; judging whether a given ownership
change is "material enough to matter" (Q041/Q042/Q043's filtering
question) combines a code-defined materiality threshold with an LLM read
on context the threshold alone can't capture (e.g., a small filing that's
actually part of a larger known consolidation story).

**Escalation:** escalates to Market Growth Q007/Q045 (provider-vs-demand
divergence) and to the Emerging Trends agent when a cluster pattern
(Q091) is detected but not yet confirmed.

---

## 6. Medicare Advantage & Part D Intelligence

**Mission:** track MA/Part D enrollment, penetration, plan structure,
Star Ratings, and Part D-specific economics.

**Executive questions owned:** Q046–Q055 (MA & Part D), and jointly owns
Q096–Q101 (Pharmacy & Part D economics) with the Claims/Utilization/Cost
agent (this agent owns the Part D-specific mechanics; Claims/Utilization/
Cost owns drug spend as a general cost category).

**In scope:** MA/Part D public enrollment and plan-design tracking,
penetration-rate calculation, Star Ratings monitoring.

**Out of scope:** plan-level financial/claims detail beyond public
aggregates (not public — flagged in `DATA_GAP_REGISTER.md`, this agent
must not imply it has this detail).

**Inputs:** CMS MA/Part D enrollment public files, Star Ratings public
data, Plan Benefit Package (PBP) public files, Medicare Part D
Prescribers PUF, CMS Drug Price Negotiation Program data.

**Outputs:** `Insight` objects tagged to Q046–Q055 and (jointly) Q096–Q101.

**Dependencies:** Data Architecture agent (for the shared population
definitions that keep MA/Part D beneficiaries clearly distinct from FFS
in every cross-agent comparison — see the master orchestrator's "never
equate Medicare FFS with MA" rule).

**LLM vs. code split:** penetration/enrollment-trend math is code;
interpreting a Star Ratings release or a benefit-design filing's likely
competitive implication is the LLM step.

**Escalation:** escalates to Data Architecture immediately if any
downstream agent's output appears to blend FFS and MA populations without
labeling — this is treated as a data-integrity issue, not a normal
analytical finding.

---

## 7. Medicaid, CHIP & Dual Eligible Intelligence

**Mission:** track state-level Medicaid/CHIP enrollment, churn, managed
care, and dual-eligible trends.

**Executive questions owned:** Q056–Q065 (Medicaid, CHIP & Duals).

**In scope:** state-administered program tracking, with explicit per-state
vintage/consistency labeling (this agent's data is structurally less
uniform than the federal MA/Part D datasets, and its output must say so).

**Out of scope:** MA D-SNP-specific plan mechanics (delegates to MA/Part D
agent for Q061's cross-program spillover question — this agent flags the
Medicaid-side signal, MA/Part D agent confirms any D-SNP-side effect).

**Inputs:** T-MSIS public releases, Medicaid.gov state-level data, CMS
Medicaid managed care enrollment reports.

**Outputs:** `Insight` objects tagged to Q056–Q065, each carrying an
explicit per-state data-vintage field (not just one dataset-wide freshness
value, since states report at different cadences).

**Dependencies:** Data Source & CMS Change Monitor; Policy/Regulation/CMS
Programs agent (state waiver tracking overlaps with this agent's Q058).

**LLM vs. code split:** enrollment/churn-rate math is code; identifying
which of the 50 states' policy changes are actually material (Q058) is a
code-defined threshold plus an LLM read, same pattern as agent #5's
Q041–Q043.

**Escalation:** escalates to MA/Part D agent for D-SNP crossover signals,
to Policy/Regulation/CMS Programs for waiver-driven changes.

---

## 8. Commercial / Marketplace Intelligence

**Mission:** track ACA Marketplace enrollment, premiums, benefit design,
service areas, and issuer participation.

**Executive questions owned:** Q066–Q072 (Commercial/Marketplace).

**In scope:** individual/small-group ACA exchange market tracking.

**Out of scope:** broader commercial/employer-sponsored insurance (not
covered by any dataset this agent has access to — explicitly a data gap,
see `DATA_GAP_REGISTER.md`; this agent must never imply Marketplace PUF
data represents the full commercial market).

**Inputs:** CMS Marketplace Public Use Files (PUFs).

**Outputs:** `Insight` objects tagged to Q066–Q072.

**Dependencies:** Data Source & CMS Change Monitor.

**LLM vs. code split:** premium/benefit/service-area delta calculations
are code; synthesizing Q072's "what does this suggest about broader
market movement" is the LLM step, explicitly scoped to the ACA-Marketplace
population only.

**Escalation:** escalates to Emerging Trends when a Marketplace signal
appears to correlate with a Medicaid signal in the same state (possible
churn between programs) — flagged as a correlation, not asserted as a
causal pathway.

---

## 9. Policy, Regulation & CMS Program Intelligence

**Mission:** track CMS announcements, proposed/final rules, and program
expansion/contraction across every program the other agents track.

**Executive questions owned:** Q073–Q084 (Policy/CMS), and co-owns
Q102–Q107 (Value-Based Care) with the Provider/Network agent (this agent
owns CMMI/MSSP program-level tracking; Provider/Network owns the
consolidation/concentration side of Q107).

**In scope:** rule-cycle tracking (proposed → final → effective), program
expansion/contraction, and routing signals to the domain agent each rule
actually affects (Q077–Q080 exist specifically to formalize this routing).

**Out of scope:** the domain-specific interpretation of a routed signal —
this agent identifies *that* a rule affects payment/providers/
beneficiaries/utilization; the receiving domain agent interprets what it
means there.

**Inputs:** Federal Register, CMS.gov newsroom, regulations.gov, CMMI
model pages, Shared Savings Program public reporting files.

**Outputs:** `Insight` objects tagged to Q073–Q084 and (jointly) Q102–Q107;
also routing signals consumed by Reimbursement, Provider/Network, MA/
Part D, Medicaid, and Marketplace agents.

**Dependencies:** functions as an upstream signal source for nearly every
other domain agent — second-most-connected agent after the Orchestrator.

**LLM vs. code split:** effective-date and rule-status tracking is code
(structured extraction from Federal Register metadata); routing
determination (which domain(s) a rule affects) and impact narrative are
the LLM step.

**Escalation:** escalates directly to whichever domain agent(s) a routed
rule affects; escalates to the Orchestrator when a rule is broad enough to
affect four or more domains at once (treated as itself an executive-level
signal, not just a routed one).

---

## 10. Emerging Trends & Signal Detection

**Mission:** find signals that don't map cleanly to an existing question —
cross-dataset corroboration, direction reversals, and genuinely new
patterns.

**Executive questions owned:** Q085–Q095 (Emerging Trends).

**In scope:** synthesis across the other 9 domain agents' outputs.
**Implementation note (Phase 5 addendum, 2026-09-23):** the real
implementation (`agents/emerging-trends/agent.ts`) pragmatically reads
two adapters' raw snapshots directly (Hospital General Information +
Medicare Physician & Other Practitioners) rather than consuming other
agents' structured `Insight` objects through a shared context —
`AgentContext` has no `priorInsights` field yet. This is a documented
simplification, not the design ideal stated above; threading accumulated
`Insight` objects through `fullSweep.ts` so this agent genuinely
consumes other agents' output is a reasonable future refinement, not
done here under time pressure. The output is still a real, honest,
two-source-cited cross-dataset finding (Q088: state-level correlation
between hospital facility count and average Medicare physician payment)
— the "agents working together" demonstration is real even though the
data-flow mechanism isn't yet the fully generic version described above.

**Out of scope:** confirming a signal within a single domain — that stays
the owning domain agent's job; this agent's value is specifically
cross-domain and residual (Q095's "what question are we not asking").

**Inputs:** `Insight` objects from agents #2–#9 (design intent); today,
the raw snapshots those agents' sources are built from (implementation
reality — see note above).

**Outputs:** `Insight` objects tagged to Q085–Q095; also proposed new
catalog entries when Q095/Q112-type findings occur (written as a draft,
not auto-merged into `EXECUTIVE_QUESTION_CATALOG.md` — same
parse-then-confirm discipline as `pipeline/projectCardAgent.ts`).

**Dependencies:** every domain agent's output; runs last among the domain
agents, immediately before the Orchestrator.

**LLM vs. code split:** cross-dataset corroboration/divergence detection
(Q088/Q089) is code (a defined comparison function); everything about
*why* a corroborated or divergent signal matters is the LLM step.

**Escalation:** escalates every finding to the Orchestrator by design —
this agent doesn't have further-downstream agents to hand off to, since
its whole job is already cross-domain synthesis.

---

## 11. Data Source & CMS Change Monitor

**Mission:** run cheaply and often, detect when any tracked source has
new/updated/retired/delayed/changed data, and gate everything downstream.

**Executive questions owned:** none directly — this agent is
infrastructure that makes every other agent's freshness/evidence fields
trustworthy, not a question-answering agent itself.

**In scope:** pure diffing against the source registry (`cms-intelligence/
data/sources/`); no LLM calls, ever, per `COST_AND_OPERATING_MODEL.md`'s
explicit example of this exact agent.

**Out of scope:** interpreting *what* a detected change means — it hands
off "this changed" to the relevant domain agent, which does the
interpretation.

**Inputs:** live CMS Provider Data Catalog / datastore API endpoints
(the same pattern `pipeline/pullCmsData.ts` already proves works), plus
the source registry's known dataset list and expected update cadence.

**Outputs:** a diff object per source (added/updated/retired/delayed/
changed), consumed by every other agent as their run-gate.

**Dependencies:** none upstream — this is the first agent to run each
cycle.

**LLM vs. code split:** 100% code. "If nothing changed, nothing
downstream gets called — not 'called with an empty prompt,' not called at
all" (`COST_AND_OPERATING_MODEL.md`, verbatim requirement).

**Escalation:** escalates to the Orchestrator directly (bypassing domain
agents) when a source is retired or delayed beyond its expected cadence —
that's a data-integrity/coverage issue for leadership to know about
regardless of whether any domain signal changed.

---

## 12. Data Architecture & Semantic Model

**Mission:** own the semantic model (canonical entity/population/geography
definitions) that keeps every other agent's outputs comparable and keeps
the "never combine datasets without checking definitions" rule structurally
enforced rather than just documented.

**Executive questions owned:** none directly — same infrastructure role as
agent #11, but for definitions rather than freshness.

**In scope:** canonical definitions for population (FFS/MA/Medicaid/
Marketplace, kept distinct), geography (county/state/CBSA/HRR crosswalks),
time period conventions, and the `Insight` schema itself
(`EVIDENCE_MODEL.md` is this agent's primary artifact).

**Out of scope:** any domain-specific analysis — this agent never produces
a market/clinical/policy finding itself.

**Inputs:** every other agent's proposed field usage; CMS's own published
data dictionaries per dataset.

**Outputs:** the semantic model (schemas, crosswalks, enums) that every
other agent's code imports from `cms-intelligence/intelligence/` rather
than each agent defining its own geography/population handling
independently (the risk Phase 1 flagged: without this, twelve agents could
each drift toward slightly different definitions).

**Dependencies:** none upstream for its own operation, but every other
agent depends on it.

**LLM vs. code split:** entirely code/schema — this agent has no LLM step.
Its "intelligence" is in the design of the shared model, done once by a
human/Claude Code during Phase 3 implementation, not re-derived at runtime.

**Escalation:** is the escalation *target* for any agent that detects a
population/geography/definition mismatch (per agent #6's escalation rule
above, generalized to all agents) — resolves the ambiguity and updates the
shared model rather than letting each agent resolve it independently.
