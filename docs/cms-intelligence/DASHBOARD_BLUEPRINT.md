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

## Chart conventions (binding on every chart component, not just Phase 5)

Learned the hard way across several rounds of direct feedback on the
live page — stated here as rules, not narrated as history:

- **Center every chart within its card, and wrap it in a horizontally
  scrolling container.** A chart wider than its card must scroll, never
  clip or overflow the card edge. Enforced today in every component
  under `components/charts/` (`BarChart`, `DonutChart`, `BoxPlot`,
  `LineChart`) via `{ overflowX: "auto", display: "flex",
  justifyContent: "center" }` — copy this wrapper for any new chart.
- **Compute label-column width from the actual longest label**, never a
  fixed guess — a hardcoded 64px column once clipped real labels (e.g.
  "Diagnostic Radiology") off the edge. See `BarChart.tsx`'s
  `estimateTextWidth`/`labelWidth` for the pattern.
- **Boxplot whiskers use the standard Tukey convention** (1.5× IQR from
  the box), never raw sample min/max — a raw-range whisker lets one real
  outlier flatten every other group's box into an unreadable sliver.
  Real values beyond the whisker are outliers, plotted individually, not
  discarded. Implemented once in `intelligence/metrics/metrics.ts`'s
  `tukeyBox()` — reuse it, don't reimplement.
- **One hue for magnitude comparisons** (bar/boxplot — this site's amber
  accent); **the categorical palette for part-to-whole/identity charts**
  (donut), always with a legend when there are 2+ slices. See
  `components/charts/chartTheme.ts`.
- **No dual-axis charts** (two y-scales) — a documented anti-pattern.
  **No fabricated geography** — a map needs real, verified boundary-path
  data; guessing at one misrepresents geography, so omit the chart and
  say why instead.
- **Never fabricate data to fill a chart type.** An insight or dataset
  with no natural chart segmentation simply has no `chart` field — same
  discipline as the `series` field for trend charts.
- A single current value is a stat tile (`StatTile.tsx`), not a one-bar
  bar chart.

These conventions produced `components/Sparkline.tsx` (multi-snapshot
trend lines), `components/charts/{BarChart,DonutChart,BoxPlot,
StatTile}.tsx` (single-snapshot cross-sections — a chart needs no
history to be real, it only needs real data), and
`components/AnalyticsExplorer.tsx` ("Data Explorer" — a standalone
BI-style section separate from agent-finding cards, backed by
`cms-intelligence/analytics/overview.ts`, reading the real adapters
directly rather than only what an agent judged insight-worthy).

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
