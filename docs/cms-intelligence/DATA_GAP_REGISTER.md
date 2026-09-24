# Data Gap Register — Healthcare Intelligence Executive Dashboard

Phase 2 deliverable per `02_PHASE_2_INTELLIGENCE_BLUEPRINT.md` §7.
Important questions the catalog raises that **cannot** be answered with
public data alone. This register exists so the system is honest about its
own limits rather than quietly producing a confident-looking answer to a
question public data doesn't actually support — the direct implementation
of the master orchestrator's "do not hide data limitations" rule at the
program level, not just the per-insight level `EVIDENCE_MODEL.md` already
handles.

Any question below that a domain agent is tempted to answer anyway must
instead return the `insufficient_evidence` escalation defined in
`AGENT_ARCHITECTURE.md`'s cross-cutting rules.

## 1. Real payer-specific claims, membership, and financial performance

**Missing source:** no public dataset contains any specific health
insurer's actual membership, claims, medical loss ratio, or financial
performance at the plan/member level.

**Why it matters:** this is the single biggest gap relative to what an
actual enterprise payer's executive team would want — their own real
performance, not a market proxy.

**Possible internal source:** a real payer's own claims/membership
warehouse (not available to this portfolio project, by design and by the
master orchestrator's non-negotiable constraint).

**Possible public proxy:** aggregate public MA/Part D enrollment and
Star Ratings data (Q046–Q055) as a market-level proxy — never a
substitute for actual plan performance.

**Synthetic/demo approach:** where Q031/Q055-class "internal vs. external
benchmark" questions are demonstrated, use clearly labeled synthetic data
only (per `CLAUDE.md`'s existing guardrail) — never real employer/client
figures.

**Data-risk caveat:** any dashboard element addressing this gap must
visibly state it's comparing public market data or synthetic data, never
implying access to a real payer's actual book of business.

## 2. Real-time claims (public data lag)

**Missing source:** public CMS claims-derived files (e.g., Medicare
Physician & Other Practitioners) typically lag roughly a year or more
behind the current date — there is no public near-real-time claims feed.

**Why it matters:** several questions (Q084's "hasn't appeared in claims
yet" framing, Q034/Q035's leading-vs-lagging policy questions) are
explicitly built around this lag, but the lag itself limits how current
any claims-based finding can be.

**Possible internal source:** a real payer's own claims pipeline, which
typically has much shorter latency than public CMS releases.

**Possible public proxy:** none closes this gap meaningfully — the lag is
structural to how CMS publishes these specific files.

**Synthetic/demo approach:** not applicable — this is a freshness/latency
gap, not a missing-category gap; the correct response is transparent
labeling (`Freshness.dataAsOf`, `isStale`) rather than any workaround.

**Data-risk caveat:** every claims-based insight must carry an honest
`dataAsOf` date; the dashboard must never present a claims-derived finding
as "current" when it reflects data from a year or more prior.

## 3. Commercial / employer-sponsored insurance data

**Missing source:** no dataset in this project's source list covers the
broader commercial/employer-sponsored insurance market — Marketplace PUFs
cover only the individual/small-group ACA exchange population, a
meaningfully different and smaller population.

**Why it matters:** commercial/ESI is a large share of the overall
insured market and a natural question for any payer-focused executive
audience, but this project has no public source for it.

**Possible internal source:** a real payer's own commercial book (not
available here).

**Possible public proxy:** Marketplace PUFs, clearly labeled as
individual/small-group exchange data only, not general commercial.

**Synthetic/demo approach:** if a commercial-market illustration is ever
needed, clearly labeled synthetic data, consistent with existing site
guardrails.

**Data-risk caveat:** the dashboard and any narrative must never use
"commercial" and "Marketplace" interchangeably — this is exactly the kind
of population conflation `METRIC_DICTIONARY.md` and the master
orchestrator both warn against.

## 4. Provider contracted rates / true price transparency

**Missing source:** hospital price-transparency files exist publicly (per
CMS's hospital transparency enforcement program, named in
`00_MASTER_ORCHESTRATOR.md`'s Phase 4 list) but are well documented
industry-wide as inconsistent in format, completeness, and machine-
readability across hospitals.

**Why it matters:** Q014's "growing because of price" and Q032's
"provider economics" questions would ideally use real contracted rates,
not just CMS fee-schedule rates (which apply only to FFS, not negotiated
commercial/MA rates).

**Possible internal source:** a real payer's own contracted-rate
database.

**Possible public proxy:** hospital price-transparency machine-readable
files, used cautiously and only where a given facility's files are
actually complete and parseable — not assumed reliable by default.

**Synthetic/demo approach:** not the right tool here — this is a data-
quality gap, not a missing-category gap; better to explicitly limit scope
to what the transparency files reliably support than to synthesize
plausible-looking contracted rates.

**Data-risk caveat:** any use of price-transparency files must state
per-facility whether the underlying file was usable, since silently
skipping unusable files without disclosure would bias any resulting
comparison.

## 5. True network adequacy / access (wait times, appointment availability)

**Missing source:** no public dataset measures actual patient wait times
or appointment availability — Q007's "provider and population growth
diverging" question can only proxy access risk through capacity/demand
ratios, not real access outcomes.

**Why it matters:** capacity divergence is a reasonable early-warning
proxy, but it is not the same thing as confirmed access degradation, and
the dashboard must not blur that distinction.

**Possible internal source:** a real payer's own network-adequacy
monitoring or member-experience data.

**Possible public proxy:** provider/facility count and growth-rate
divergence (already the basis for Q007/Q045).

**Synthetic/demo approach:** not applicable.

**Data-risk caveat:** Q007-class insights must explicitly state "proxy
only, not a measured access outcome" in their `limitations` field — this
requirement is already reflected in `EXECUTIVE_QUESTION_CATALOG.md`'s
notes for Q007.

## 6. Medicaid data consistency across states

**Missing source:** not a fully missing category, but a materially
inconsistent one — T-MSIS and state-level Medicaid reporting vary in
completeness, format, and lag across all 50 states plus DC and
territories.

**Why it matters:** Q056–Q065's entire category is weaker on data
reliability than the federally uniform MA/Part D category, which affects
how confidently any Medicaid-category insight can be stated.

**Possible internal source:** none — this is a public-program structural
issue, not something an internal source would resolve differently.

**Possible public proxy:** already the primary source (T-MSIS,
Medicaid.gov) — there's no better public proxy to fall back to.

**Synthetic/demo approach:** not applicable — the honest response is
per-state vintage labeling, already specified as a required field on
every Medicaid-category `Insight` in `AGENT_ARCHITECTURE.md` §7.

**Data-risk caveat:** never present a 50-state Medicaid comparison as if
all states' data shares the same freshness/completeness — the per-state
vintage field exists specifically to prevent this.

## 7. Causal attribution for any cross-domain "driver" claim

**Missing source:** no dataset directly measures *why* a given change
happened — every "driver" claim (Q017, Q033, Q061, Q107) is necessarily
inferential, built from correlated timing and plausible mechanism, not
observed causality.

**Why it matters:** this is arguably the most important gap to name
explicitly, since it's not fixable by adding another dataset — it's a
structural limit of observational public data, and the system's
credibility depends on never overstating certainty here.

**Possible internal source:** none would fully resolve this either — even
a real payer's own data rarely supports strict causal inference without
a controlled comparison, which healthcare market data essentially never
provides.

**Possible public proxy:** the existing `Driver.relationship` field in
`EVIDENCE_MODEL.md` (correlation / stated-mechanism / confirmed-causal)
is the system's structural answer to this gap — it doesn't close the gap,
it discloses it on every single driver claim.

**Synthetic/demo approach:** not applicable.

**Data-risk caveat:** the `relationship` field must never default to
`"confirmed-causal"` — that value should be reserved for genuinely rare
cases (e.g., a CMS rule whose stated, published purpose is exactly the
observed effect) and treated as the exception, not the norm.

## 8. Federal grants rescinded (researched and found infeasible, not built)

**Missing source:** no free, public dataset flags a grant as
*rescinded*. This was researched directly (2026-09-24, as part of scoping
the Market/Catalyst Intelligence agent's 4th planned data source) rather
than assumed — the finding is a deliberate, informed "do not build," not
an unexamined gap.

**Why it matters:** a real "grants rescinded" signal would be a
genuinely useful market-catalyst read (funding pulled from an
organization/program is a real disruption signal) — the kind of thing
this project would otherwise want to add alongside the other three real
NIH/FDA/SEC/ClinicalTrials.gov sources built the same day.

**Why it's infeasible, specifically:** USAspending (the obvious candidate
public source) records negative grant-obligation amounts routinely for
reasons that have nothing to do with a rescission — Medicaid entitlement
true-ups and Ryan White Title II revisions being the two most common,
both verified as real, routine, non-rescission causes during this
research. There is no field, flag, or documented convention in any free
public dataset that distinguishes an actual rescission from these
routine negative-obligation corrections. Building a "rescinded grants"
insight from this data would mean either (a) treating every negative
obligation as a rescission, which would be a fabricated, wrong claim most
of the time, or (b) guessing at a filtering heuristic with no real
documented basis — both violate this project's "no fabrication" rule more
directly than simply not building the feature.

**Possible internal source:** a federal agency's own grants-management
system would have this distinction natively (a real administrative
rescission action vs. a routine obligation adjustment) — not available to
this portfolio project.

**Possible public proxy:** none identified that reliably distinguishes
the two cases — this is the reason for the "infeasible," not "possible
proxy: use X cautiously."

**Synthetic/demo approach:** not applicable — fabricating a plausible-
looking "rescinded grants" figure would be exactly the kind of confident-
looking wrong answer this register exists to prevent.

**Data-risk caveat:** if this gap is ever revisited, the bar is a real,
documented source field or convention that actually distinguishes a
rescission from a routine negative-obligation correction — not a
heuristic threshold on obligation-amount sign or magnitude alone.
