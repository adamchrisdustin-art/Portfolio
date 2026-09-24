# Dashboard Information Architecture — Healthcare Intelligence Executive Dashboard

Phase 2 deliverable per `02_PHASE_2_INTELLIGENCE_BLUEPRINT.md` §6. Defines
the seven executive dashboard layers from `00_MASTER_ORCHESTRATOR.md`.
Implementation is Phase 5 — this is the blueprint that phase must match.

## Public-copy and audience requirements (apply to every layer below)

Two requirements Adam added mid-Phase-2 (2026-09-23), binding on all seven
layers and on the dashboard shell itself:

1. **No real company naming.** No layer's UI copy, chart labels, or
   narrative text may name UnitedHealthcare or Optum — use generic
   descriptors ("a national health insurer," "an enterprise payer"). This
   is a public-copy rule (see project memory), enforced the same way
   `EVIDENCE_MODEL.md`'s `businessRelevance` field is flagged in
   `AGENT_ARCHITECTURE.md`.
2. **A nontechnical explainer is required**, not optional polish. The
   dashboard shell needs a plain-language "How this works" panel/page
   (see the Executive Pulse layer below, where it lives) that a visitor
   with no healthcare-data or AI background can read and understand what
   the system does and why it's credible — distinct from the technical
   README/docs, which stay technical.

## Routing note (carried from `PROJECT_BOUNDARY.md`)

Given the site's static-export assumption (Phase 1 finding — stated in
`next.config.ts` but not enforced), the seven layers below are designed as
**sections/tabs within a single route**, `app/healthcare-intelligence/
page.tsx`, rather than seven separate Next.js routes. This avoids seven
separate static pages for what's really one connected experience, and
keeps client-side layer-switching simple. This is a recommendation for
Phase 5 to confirm, not a decision this document forces — if Phase 5
finds a reason seven real routes serve the content better (e.g., direct
deep-linking to one layer), that's a legitimate reason to deviate,
documented at that time.

---

## Layer 1 — Executive Pulse

**Executive questions:** Q108–Q112 (Executive Strategy), plus a rollup of
the single highest-confidence, highest-relevance insight from each other
layer.

**Data required:** the Executive Orchestrator's ranked output (see
`AGENT_ARCHITECTURE.md` §1) — this layer never queries raw agent output
directly, only the Orchestrator's synthesized result.

**Visual types:** a small number (3–5) of headline insight cards, each
showing headline, magnitude, confidence badge, and freshness date; a
compact "what changed since last review" diff list (Q108).

**Interactions:** click any card to open its full evidence trail (shared
evidence-drawer component, used by every layer — see "Evidence behavior"
below); a persistent, non-dismissive **"How this works" entry point**
(this is where the nontechnical explainer requirement lives — a distinct
panel or modal, written for a general audience, separate from any
technical "About the agent architecture" content that might exist
elsewhere for a technical audience).

**Drilldowns:** each headline card links to its originating layer (2–7)
for full context.

**Evidence behavior:** every card visible on this layer must be backed by
an `Insight` object per `EVIDENCE_MODEL.md` — no summary statistic
appears here that isn't traceable to a full insight one click away.

**Alerts:** this is the layer alerts surface on, if/when Phase 5 adds a
notification mechanism — out of scope to design further here, flagged as
an open Phase 5 decision.

---

## Layer 2 — Market & Growth

**Executive questions:** Q001–Q010 (Market & Growth), **plus Q046–Q072
(MA/Part D, Medicaid/Duals, Marketplace)** — corrected during Phase 5
implementation. The master orchestrator's 7 named layers never gave
enrollment/market-structure questions from those three categories a home
of their own, and this document inherited that gap on first write. They
fold into this layer because its own stated content ("enrollment...
market composition... CMS program participation") already covers them
conceptually. See `cms-intelligence/agents/dashboardLayers.ts` for the
codified mapping this correction produced.

Consuming Market Growth & Geographic Intelligence agent output for
Q001–Q010; MA/Part D, Medicaid, and Marketplace agent output for the rest.

**Data required:** geography-keyed growth/acceleration/divergence
insights; underlying enrollment/utilization/provider-capacity time series
for chart rendering (not just the insight summary — a trend chart needs
the series, not only the headline number).

**Visual types:** a choropleth-style geography view (state/county) for
Q001/Q003; small-multiple line charts for Q002/Q005 (growth rate over
time, not just level); a paired bar/line for Q007/Q045's divergence
questions (two series, provider growth vs. demand growth, shown together
so the divergence itself is visible, not left for the reader to infer
from two separate charts).

**Interactions:** geography drilldown (national → state → county);
toggle between FFS/MA/Medicaid/Marketplace views (never blended by
default, per the population-integrity rule — a blended cross-population
view is only ever an explicit, clearly labeled opt-in).

**Drilldowns:** from a geography into Layer 3 (Claims & Cost) for that
same geography's utilization detail; into Layer 5 (Provider & Network)
for that geography's supply-side detail.

**Evidence behavior:** same shared evidence-drawer pattern as Layer 1.

**Alerts:** flags when a market crosses the materiality threshold defined
in `TREND_FRAMEWORK.md` (e.g., new entry into the watch-list).

---

## Layer 3 — Claims & Cost

**Executive questions:** Q011–Q025 (Claims & Utilization) plus Q096–Q101
(Pharmacy & Part D economics), consuming Claims/Utilization/Cost and
MA/Part D agent output.

**Data required:** service-category-level utilization and cost time
series with the volume/price/intensity/mix decomposition
(`METRIC_DICTIONARY.md` "Growth") available per category, not just the
net growth figure — the decomposition is the point of this layer.

**Visual types:** a stacked/waterfall chart showing the volume-price-
intensity-mix decomposition for a selected category (this is the layer's
signature visual — it's the one place the dashboard shows *why* a number
moved, not just that it moved); site-of-care shift charts (Q018–Q021) as
paired trend lines (inpatient vs. outpatient, facility vs. ASC, etc.).

**Interactions:** select a service category to see its decomposition;
toggle site-of-care comparison pairs.

**Drilldowns:** from a category into Layer 4 (Reimbursement) if the price
component looks rate-schedule-driven (per the agent-level escalation rule
in `AGENT_ARCHITECTURE.md` §3).

**Evidence behavior:** decomposition components each cite their own
evidence — a "price" bar in the waterfall must be traceable to the
specific rate data that produced it, not just the aggregate insight.

**Alerts:** new-service-category-emergence flags (Q025).

---

## Layer 4 — Reimbursement & Provider Economics

**Executive questions:** Q026–Q035 (Reimbursement).

**Data required:** rule-cycle status (proposed/final/effective) per
tracked rule; specialty/procedure/facility exposure lists per rule.

**Visual types:** a rule-status timeline (proposed → comment → final →
effective, shown as stages, not a single date) — this is the layer's
structural enforcement of "never represent proposed policy as final" at
the UI level, mirroring the schema-level enforcement in `EVIDENCE_MODEL.md`;
an exposure heat-table (specialty × procedure, colored by exposure level)
for Q027–Q029.

**Interactions:** filter exposure table by specialty or facility type;
click a rule to see its full status timeline and cited text.

**Drilldowns:** into Layer 3 for Q035's "did this actually show up in
claims yet" follow-through — explicitly designed as a two-step
experience (the rule itself, then a separate, honest check on whether
its effect has appeared in claims data yet, which may be "not yet").

**Evidence behavior:** every rule-status stage cites its own source
(Federal Register entry, etc.) — the timeline is not just a designed
graphic, each stage is evidence-backed.

**Alerts:** new proposed rule, rule finalized, rule effective-date
reached.

---

## Layer 5 — Provider & Network

**Executive questions:** Q036–Q045 (Provider & Network) plus Q102–Q107
(Value-Based Care), consuming Provider/Network and Policy agent output.

**Data required:** provider/facility count time series by geography;
ownership-change event log; concentration-ratio time series;
ACO/MSSP participation and performance data.

**Visual types:** concentration-ratio trend line with a materiality-
threshold reference line (so a viewer can see at a glance whether current
concentration is in "notable" territory, not just its raw value);
ownership-change event timeline; an ACO participation/performance view
for Q102–Q107, explicitly separate from the general provider-concentration
view since VBC has its own two-sided-risk-track dimension (Q104) that a
generic concentration chart wouldn't capture.

**Interactions:** filter by geography, ownership-change materiality,
ACO track type (one-sided/two-sided).

**Drilldowns:** into Layer 2 (Market & Growth) for Q007/Q045's
provider-vs-demand divergence; into Layer 6 (Policy) for Q106's CMMI
model tracking.

**Evidence behavior:** shared evidence-drawer pattern.

**Alerts:** material ownership change detected; new ACO participation
agreement; MSSP annual results release.

---

## Layer 6 — Policy & Program Watch

**Executive questions:** Q073–Q084 (Policy/CMS Programs), plus routing
context for Q077–Q080's cross-layer effects.

**Data required:** rule/program tracking feed from the Policy agent;
routing metadata (which other layer(s) a given policy item affects).

**Visual types:** a chronological feed of policy/program items, each
tagged with its routing destination(s) as clickable badges (e.g., a rule
tagged "affects payment → Layer 4" is a direct link, not just a label) —
this is the layer that makes the cross-agent routing designed in
`AGENT_ARCHITECTURE.md` §9 visible and navigable, not just an internal
mechanism.

**Interactions:** filter feed by routing destination, by program, by
status (proposed/final/effective).

**Drilldowns:** to whichever layer(s) a policy item's routing tags point
to.

**Evidence behavior:** every feed item cites its source (Federal
Register, CMS.gov, etc.) directly in the feed, not hidden behind an extra
click — policy source citation is high-value enough to surface
immediately.

**Alerts:** this layer is itself mostly an alert feed by design — new
item, status change, and upcoming effective-date reminders.

---

## Layer 7 — Emerging Signals

**Executive questions:** Q085–Q095 (Emerging Trends).

**Data required:** the Emerging Trends agent's cross-domain output,
including watch-list entries not yet promoted to full insights (per
`TREND_FRAMEWORK.md`'s watch-list mechanism) — this layer is explicitly
where a visitor can see signals *before* they've fully matured into a
confident trend, clearly labeled as such.

**Visual types:** a confidence-tiered list (watch-list / anomaly /
confirmed-trend, as three visually distinct groups, not blended) so a
viewer never mistakes an early watch-list entry for a confirmed finding;
a cross-dataset corroboration view for Q088/Q089 showing which datasets
agree and which diverge, side by side.

**Interactions:** filter by confidence tier; click a watch-list entry to
see how close it is to promotion (e.g., "2 of 2 periods needed" progress
indicator, directly surfacing `TREND_FRAMEWORK.md`'s Persistence rule to
the viewer).

**Drilldowns:** to whichever domain layer a promoted signal belongs to.

**Evidence behavior:** watch-list entries are explicitly marked as
*not yet* meeting full evidence/confidence standards — this layer is the
one place the dashboard shows provisional content, and it must never look
visually equivalent to a confirmed `Insight` card elsewhere.

**Alerts:** watch-list entry promoted to confirmed trend; new anomaly
detected.

---

## Charts (Phase 5 addendum, 2026-09-23 — two passes)

**First pass** shipped `components/Sparkline.tsx`, an inline-SVG line
chart for real multi-snapshot time series (see `EVIDENCE_MODEL.md`'s
`series` field). Reasoned at the time that richer chart types "weren't
worth building without more period-over-period history" — **that
reasoning was wrong**, and Adam called it out directly: a bar chart of
current facility counts, a donut of ownership-type share, or a boxplot
of a value's distribution across states make no trend claim at all —
they visualize a single real cross-section, which this system already
had plenty of. Conflating "not enough history for a trend chart" with
"no charts at all" was the actual mistake.

**Second pass** (same day) fixed this properly, per the `dataviz` skill
(loaded before writing any chart code, per that skill's own instruction)
— see `EVIDENCE_MODEL.md`'s `chart` field (`ChartBar` / `ChartDonut` /
`ChartBoxPlot`) and `components/charts/`:

- `BarChart.tsx` — magnitude comparisons (facility count by state,
  episodes-per-agency by state, payment-to-charge ratio by provider
  type), single hue (this site's amber accent — sequential color job per
  the skill, not the skill's generic blue default) so charts read as
  part of the same product.
- `DonutChart.tsx` — part-to-whole/identity (hospital ownership-type
  share), the skill's validated categorical palette with a legend
  (skill's "legend always present for 2+ slices" rule).
- `BoxPlot.tsx` — distribution across a segmentation (spending-ratio by
  state), standard Tukey whiskers (1.5× IQR) with real outliers plotted
  as individual points rather than a raw min/max whisker — the first
  version used raw min/max, which let one real outlier (a California
  agency at 5.27 vs. a typical ~1.0) stretch the axis and flatten every
  other state's box into an unreadable sliver; fixed to the standard
  convention after visually inspecting the rendered chart, per the
  skill's step 7 ("render it and look at it").
- `StatTile.tsx` — the KPI row at the top of the dashboard (agents run,
  insights returned, datasets wired, layers with real findings) — real
  sums, per the skill's "a single current value is a stat tile, not a
  one-bar bar chart" rule.

Every chart is real, computed data — never fabricated to fill a chart
type. An insight with no natural chart (e.g. a single national baseline
number with no segmentation) simply has no `chart` field, same discipline
as `series`.

**Third pass** (same day): after seeing the two charts above rendered on
agent-finding cards, Adam clarified he *also* wanted — separately from
those, not instead of them — a standalone Tableau-style analytics section
covering the underlying data broadly, referencing two real Tableau
Public dashboards (a hospital summary and a clinic performance
dashboard) as the target look. Built `components/AnalyticsExplorer.tsx`
("Data Explorer"), a distinct section with its own dark header band,
positioned between "How this works" and the agent-finding cards, backed
by `cms-intelligence/analytics/overview.ts` — a new computation module
reading the same three real adapters directly (not filtered through
what an agent judged insight-worthy). Deliberately did **not** replicate
one thing from the reference dashboards: a dual-axis chart (two
y-scales) — the dataviz skill's #1 documented anti-pattern — used the
same real data without it instead. Also deliberately skipped a
geographic US state map (no verified state-boundary path data available,
and guessing at one would misrepresent geography) and a patient-flow
Sankey (no public CMS source here has patient-level clinical flow data)
— both noted explicitly in the section's own footer text rather than
silently omitted. Caught and fixed a real data bug while building this:
the home-health star-rating bar chart initially showed a bogus "-★"
category with 4,410 agencies — CMS's suppression marker (`-`) being
treated as a rating value rather than excluded; fixed with a numeric
validity check, same suppression discipline used elsewhere in this
project. 74 tests passing.

## Shared components across all seven layers

- **Evidence drawer** — a single reusable component (consistent with the
  existing site's component-reuse pattern, e.g. `TableauEmbed.tsx` being
  the one shared viz-embedding component) that renders an `Insight`
  object's full evidence trail: sources, vintage, limitations,
  contradictory evidence, confidence rationale. Every layer opens the same
  drawer, never a bespoke per-layer evidence view.
- **Freshness indicator** — a consistent visual treatment (e.g., a dated
  badge) for `Freshness.dataAsOf` and `isStale`, present on every card/
  chart across every layer, so staleness is always visible without a
  click.
- **Population badge** — a consistent, always-visible tag showing which
  `PopulationType` a given chart/card represents (FFS, MA, Medicaid,
  etc.) — the UI-level enforcement of the population-integrity rule that
  runs through this entire project.
- **"How this works" panel** — lives at the shell level (accessible from
  Layer 1 and persistently available), written for a nontechnical
  audience per the requirement at the top of this document. Content
  outline for Phase 5: what the system watches (public CMS data, named
  generically), what the agents do (in plain terms — "specialized
  reviewers, each focused on one part of the picture"), how a claim gets
  traced back to its source (the evidence-drawer concept, described
  without jargon), and an explicit "this uses public data only, not any
  real insurer's private information" statement — directly addressing
  the kind of question a nontechnical visitor would have on their own.
