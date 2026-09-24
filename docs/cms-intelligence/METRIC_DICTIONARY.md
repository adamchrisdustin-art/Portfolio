# Metric Dictionary — Healthcare Intelligence Executive Dashboard

Phase 2 deliverable per `02_PHASE_2_INTELLIGENCE_BLUEPRINT.md` §4. Canonical
formulas for every measure referenced across the question catalog and
agent architecture. Every formula states its population and denominator
explicitly, per the phase doc's requirement — a metric without a stated
population is exactly the kind of ambiguity the master orchestrator's
"never combine datasets without checking definitions" rule exists to
prevent.

Owned by the Data Architecture & Semantic Model agent
(`AGENT_ARCHITECTURE.md` §12). Lives at `cms-intelligence/intelligence/
metrics/` once implemented.

## Enrollment

**Definition:** count of beneficiaries covered under a given program, at a
given geography and point in time.

**Population/denominator:** none — this is a raw count, not a rate. Must
always be labeled with its specific population (`PopulationType` from
`EVIDENCE_MODEL.md`: FFS, MA, Part D, Medicaid, CHIP, dual-eligible, or
Marketplace) — an "enrollment" number with no population label is not
usable anywhere in this system.

**Source dependency:** each population has its own enrollment source (CMS
Monthly Enrollment for FFS/MA/Part D, T-MSIS for Medicaid/CHIP, Marketplace
PUFs for exchange enrollment) — never sum across populations without
explicitly labeling the result as cross-population.

## Utilization per 1,000

**Formula:** `(service count in period / covered population in same period) × 1,000`

**Population/denominator:** the covered population must be the *same*
population and geography as the service count's source — e.g., FFS
utilization per 1,000 uses the FFS-enrolled population in that geography
as the denominator, never total county population (which would understate
the true rate by including non-Medicare residents) and never a different
program's enrollment.

**Limitation:** requires both a utilization source and a matching-geography
population source; if geographies don't align exactly (e.g., HRR vs.
county), state the crosswalk method used or don't compute the metric.

## PMPM (per member per month)

**Formula:** `total cost in period / member-months in same period`, where
member-months = sum across all months of (enrolled members that month).

**Population/denominator:** member-months, not member *count* — a
member enrolled for 3 of 6 months in a period contributes 3 member-months,
not 1 full member. Using member-count instead of member-months
systematically overstates true per-member cost when there's any
mid-period enrollment churn.

**Critical distinction:** PMPM must specify whether "cost" means **allowed**
or **paid** amount (see below) — these produce materially different PMPM
figures and must never be used interchangeably.

## Allowed cost vs. paid cost

**Allowed cost:** the amount a payer has agreed a service is worth under
its contract/fee schedule, before member cost-sharing is subtracted.

**Paid cost:** what the payer actually paid out, after member cost-sharing
(deductible, coinsurance, copay) is subtracted from allowed cost.

**Explicit rule (master orchestrator, restated as a metric-dictionary
enforcement point):** never equate **billed charges** (a provider's list
price, often far higher than either) with allowed or paid cost. All three
are different numbers and this system must always label which one a given
`Magnitude.unit` field represents — `"USD-PMPM-allowed"` and
`"USD-PMPM-paid"` are different units, not the same unit with different
values.

## Cost per episode

**Formula:** `total allowed (or paid) cost across all claims in a defined episode / count of episodes`

**Population/denominator:** episode count, where an episode is a defined
clinical grouping (e.g., all claims within N days of an index admission for
a given condition) — the episode *definition* must be stated alongside any
cost-per-episode figure, since two different episode-window definitions
produce two different, non-comparable numbers.

## Cost per unit

**Formula:** `total allowed (or paid) cost for a service category / count of units of that service (e.g., procedures, visits, prescriptions)`

**Population/denominator:** unit count of the *same* service category as
the cost numerator — never divide one category's cost by another
category's unit count.

## Rate

**Formula:** `numerator count / denominator population, over a stated period`

**Population/denominator:** both numerator and denominator must share the
same population and geography scope — this is the general form that
"utilization per 1,000," "penetration," and "concentration" (below) are
all specific instances of. Any new rate metric added later must state its
numerator and denominator explicitly using this same discipline, not
introduce an ambiguous "rate" field.

## Benchmark

**Definition:** the comparison value a `Magnitude.comparedTo` field points
to — either (a) a prior period of the same metric (e.g., same quarter last
year), (b) a peer geography's same-period value, or (c) a published CMS
national/regional average.

**Population/denominator:** must match the metric being benchmarked
exactly in population and unit — comparing an FFS PMPM against an MA PMPM
"benchmark" is a population mismatch, not a valid benchmark, per the
master orchestrator's rule against comparing incompatible populations.

## Growth

**Formula:** `(current period value − prior period value) / prior period value`, expressed as a percent.

**Decomposition (used by Q013–Q016):** total growth in a cost/utilization
figure can be decomposed into volume (change in unit count at constant
price/intensity/mix), price (change in per-unit rate at constant volume),
intensity (change in average service complexity/RVU per encounter at
constant volume and price), and mix (change in the distribution across
service categories) components. This system uses a standard sequential
decomposition (hold all other factors at prior-period levels while
isolating one factor at a time) — documented explicitly here so any two
agents computing a decomposition use the same method and produce
comparable results.

**Population/denominator:** same population/geography across both periods
being compared — a growth figure that silently changes population
definition between periods (e.g., a geography redefinition) is invalid.

## Acceleration

**Formula:** `current period's growth rate − prior period's growth rate` (a second derivative — the change in the growth rate itself, not the change in the raw value).

**Population/denominator:** requires at least 3 consecutive periods of the
same metric/population/geography to compute (two growth-rate values, each
itself requiring two raw values).

## Penetration

**Formula:** `enrolled population in a program / total eligible population for that program, in the same geography and period`

**Population/denominator:** the eligible population is *program-specific*
— MA penetration's denominator is Medicare-eligible individuals in the
geography, not total population; Marketplace penetration's denominator is
the ACA-eligible (uninsured + individual-market-eligible) population, a
different base entirely. Never reuse one program's eligible-population
denominator for another program's penetration calculation.

## Concentration

**Formula (this system's chosen method):** concentration ratio — the
share of total volume/enrollment/revenue held by the top N entities
(providers, plans, issuers) in a geography, e.g. CR4 = combined share of
the top 4 entities. (HHI — sum of squared market shares — is a valid
alternative and may be added later if a specific question needs its extra
sensitivity to the full distribution rather than just the top N; CR4 is
the default because it's simpler to explain in executive narrative, which
matters given this system's writing-style requirement.)

**Population/denominator:** total volume/enrollment/revenue across *all*
entities in the same geography and period — a concentration ratio
computed against an incomplete entity list (e.g., only providers who
filed a specific form) will overstate concentration and must be flagged
as such if the full entity list isn't available.

## Market share

**Formula:** `a single entity's volume / total market volume, same geography and period`

**Population/denominator:** total market volume — the "market" boundary
(which entities count as competitors, which geography defines the market)
must be stated explicitly, since this is the metric most sensitive to an
implicit, undocumented market-boundary choice.

## Mix

**Formula:** `a category's volume (or cost) / total volume (or cost) across all categories, same population/geography/period`

**Population/denominator:** total across all categories in the same
classification scheme — mixing two different categorization schemes
(e.g., HCPCS-based vs. DRG-based category sets) in one mix calculation is
invalid.

## Site-of-care share

**Formula:** `service volume delivered in a given site of care (inpatient, outpatient, ASC, home, office) / total service volume for that same clinical service category, across all sites, same period`

**Population/denominator:** total volume for the *same clinical service*
across all sites — this is a special case of "mix" scoped specifically to
the site-of-care dimension, used throughout Q018–Q021 and Q094. The
clinical service category boundary must be held constant across sites
being compared (e.g., "the same procedure performed inpatient vs. at an
ASC," not two different procedures that happen to occur in different
settings).

## Cross-cutting population/denominator discipline

Every metric above inherits three non-negotiable rules from the master
orchestrator, restated here as the dictionary's own enforcement summary:

1. Never equate billed charges with reimbursement (see "Allowed cost vs.
   paid cost").
2. Never equate Medicare FFS data with MA, or MA data with any specific
   payer's performance (see "Enrollment," "Benchmark").
3. Never combine datasets without checking definitions (applies to every
   formula above that requires matching geography/population/period
   across numerator and denominator).
