# Source Registry — Healthcare Intelligence Executive Dashboard

Phase 4 deliverable per `04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`. This is
the human-readable view of `cms-intelligence/data/sources/registry.ts` —
that file is the source of truth (imported by code); this document exists
so a reader doesn't have to open TypeScript to understand what's tracked.

## How entries are verified, and why most aren't yet

Per the master orchestrator's "never invent a source" rule, extended here
to the registry itself: a source only gets specific details (real URL,
confirmed vintage, confirmed field names) once it's actually been
live-queried, not because it's plausible or well-known. Six sources have
been verified this way. Every other source named in
`04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`'s six source families is listed as
a **candidate** — real family/population/topic, honestly marked
unverified rather than filled in with a guessed dataset ID or URL.

## Verified & implemented (21 sources)

| Source ID | Name | Real endpoint | Verified | Related questions |
|---|---|---|---|---|
| `cms:hospital-general-information` | Hospital General Information | `data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0` | 2026-09-23 | Q001, Q004, Q006, Q036, Q037, Q038 |
| `cms:home-health-care-agencies` | Home Health Care Agencies | `data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0` | 2026-09-23 | Q011, Q012, Q021, Q036 |
| `cms:medicare-physician-by-service` | Medicare Physician & Other Practitioners - by Geography and Service (national, every code, 2013 onward) | `data.cms.gov/data-api/v1/dataset/{per-year id}/data` | 2026-09-25 | Q011, Q012, Q013, Q014, Q028 |
| `cms:medicare-physician-by-provider` | Medicare Physician & Other Practitioners - by Provider (every provider, 2013 onward, summarized) | `data.cms.gov/data-api/v1/dataset/{per-year id}/data` | 2026-09-25 | Q011, Q012, Q013, Q014, Q026, Q027, Q031, Q088 |
| `federal-register:cms-documents` | Federal Register - CMS documents | `federalregister.gov/api/v1/documents.json` | 2026-09-23 | Q073, Q074, Q075, Q076 |
| `cms:ma-part-d-enrollment` | MA/Part D Monthly Enrollment by Plan | `cms.gov/.../medicare-advantagepart-d-contract-and-enrollment-data/monthly-enrollment-plan` | 2026-09-23 | Q049, Q053 |
| `cms:marketplace-oep-state` | Marketplace Open Enrollment Period State-Level PUFs (every state and DC, 2017 onward) | `cms.gov/data-research/statistics-trends-and-reports/marketplace-products` | 2026-09-25 | Q066, Q067 |
| `cms:medicaid-state-enrollment` | State Medicaid and CHIP Applications, Eligibility Determinations, and Enrollment Data (every state and DC, monthly, June 2017 onward) | `data.medicaid.gov/api/1/datastore/query/6165f45b-ca93-5bb5-9d06-db29c692a360/0` | 2026-09-25 | Q056, Q065 |
| `cms:medicaid-managed-care-plans` | Medicaid Managed Care Enrollment by Program and Plan (annual, 2016 onward; comprehensive managed care counted) | `data.medicaid.gov/api/1/datastore/query/0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe/0` | 2026-09-25 | Q064 |
| `cms:marketplace-rate-puf` | Marketplace (Exchange) Rate and Plan Attributes PUFs (every HealthCare.gov state, 2014 onward) | `cms.gov/marketplace/resources/data/public-use-files` | 2026-09-25 | Q067, Q069, Q071 |
| `sec-edgar:healthcare-8k-filings` | SEC EDGAR 8-K filings, health-insurer watchlist | `data.sec.gov/submissions/CIK{10-digit}.json` | 2026-09-24 | Q120, Q121, Q122 |
| `openfda:drugsfda-novel-approvals` | openFDA drugsfda - novel (Type 1) drug approvals | `api.fda.gov/drug/drugsfda.json` | 2026-09-24 | Q117, Q118, Q119 |
| `nih-reporter:project-awards` | NIH RePORTER - project award notices | `api.reporter.nih.gov/v2/projects/search` | 2026-09-24 | Q113, Q114, Q115, Q116, Q129 |
| `clinicaltrials-gov:phase3-results` | ClinicalTrials.gov - Phase 3 results postings | `clinicaltrials.gov/api/v2/studies` | 2026-09-24 | Q123, Q124 |
| `cms:physician-fee-schedule` | Physician Fee Schedule national RVU files (latest release per year, 2013 onward) | `cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files` | 2026-09-25 | Q026, Q028, Q034, Q035 |
| `cms:hospital-penalty-programs` | HRRP, HAC Reduction and Hospital VBP, plus IPPS Tables 15 and 16B | `data.cms.gov/provider-data/api/1/datastore/query/{9n3s-kdb3, yq43-i98g, ypbt-wvdk}/0` | 2026-09-25 | Q029, Q030 |
| `cms:provider-of-services` | Provider of Services Files, QIES and iQIES (every certified facility, 2011 onward, summarized) | `data.cms.gov/data-api/v1/dataset/{per-quarter id}/data` | 2026-09-25 | Q001, Q006, Q039 |
| `cms:facility-change-of-ownership` | Hospital and SNF Change of Ownership, with Owner Information (2016 onward) | `data.cms.gov/data-api/v1/dataset/c04031db-54ce-461c-85d1-d2613d71f167/data` (+ SNF and owner files) | 2026-09-25 | Q039, Q041 |
| `cms:facility-all-owners` | Hospital and SNF All Owners, private equity owner flag (from 2025-04 / 2024-11) | `data.cms.gov/data-api/v1/dataset/029c119f-f79c-49be-9100-344d31d10344/data` (+ SNF file) | 2026-09-25 | Q041 |

### Physician Fee Schedule and hospital penalty programs (2026-09-25)

**Physician Fee Schedule RVU files** (`data/adapters/physicianFeeSchedule.ts`).
Verified live 2026-09-25: CMS's index page links one page per quarterly
release (anchor text "RVU26D" etc., back to 2003), each linking one zip.
The 2020-2022 hrefs look malformed (`/medicaremedicare-fee-service-...`)
but resolve, so links are followed as published. The national file is
`PPRRVU*.csv`; 2026 has `_nonQPP` and `_QPP` versions (two conversion
factors) and the nonQPP one is used every year. About nine title rows sit
above a split header, 2026 added a column, and 2013 uses CR line endings,
so columns are found by joining the two header rows. Conversion factors
read match CMS's published history (2013 $34.0230, 2021 $34.8931, 2024
$33.2875 after the March correction, 2025 $32.3465, 2026 $33.4009). The
latest release of each year from 2013 is kept, codes with zero RVUs are
dropped, and CPT descriptions are never stored (AMA copyright); about
2.5MB for 14 years. GPCI and locality files in the same zip aren't used.

**Hospital penalty programs** (`data/adapters/hospitalPenaltyPrograms.ts`).
Verified live 2026-09-25: Provider Data Catalog HRRP `9n3s-kdb3` (18,330
hospital x condition rows), HAC Reduction `yq43-i98g` (3,055 hospitals,
`payment_reduction` Yes/No) and HVBP Total Performance Score `ypbt-wvdk`
(2,455 hospitals), all FY2026, modified 2026-01-26. The HVBP domain
datasets (`pudb-wetr`, `su9h-3pvj`, `avtz-f2ge`, `dgmq-aat3`) were
checked and not stored, since the TPS file carries their domain scores.
The payment adjustment factors come from the FY2026 IPPS final rule page:
Table 15 (HRRP, 2,945 hospitals; 641 with no cut written as a bare "1")
and Table 16B (HVBP, 2,448). Joined to Hospital General Information by
CCN (2,919 of 2,945 matched). The FY2027 page says Table 16B comes in fall
2026 and Table 15 after hospitals' review, so the adapter reads whichever
fiscal year the datastore reports and fetches that year's tables.

### Provider of Services and facility ownership (2026-09-25)

**Provider of Services Files** (`data/adapters/providerOfServices.ts`).
Verified live 2026-09-25: QIES covers hospitals and clinics from 2011-Q4
(2018-Q4 onward every quarter), iQIES adds home health, hospice and
surgery centers from 2023-Q4, nursing homes from 2025-Q3, and dialysis
and ICF/IID after. Summarized at pull time into active facilities and
certified beds by state x facility type per quarter, plus dated openings
and closures. The 2020-Q1 QIES file (missing ~6% of nursing homes and 16%
of home health agencies) and 2020-Q2 (lost the short-term hospital
subtype) are skipped as defective; QIES quarters after home health and
surgery centers stopped updating there are skipped as frozen once iQIES
took them over.

**Hospital and SNF Change of Ownership + All Owners**
(`data/adapters/facilityOwnership.ts`). Verified live 2026-09-25: Change
of Ownership covers 2016 onward (772 hospital and 5,227 SNF rows in the
2026-Q2 release), joined to each buyer's 5%+ organization owners. All
Owners is pulled monthly and filtered server-side to
`PRIVATE EQUITY COMPANY - OWNER = Y`; the flag itself only exists from
2025-04 (hospitals) and 2024-11 (SNFs), so earlier months aren't compared.

### Full-population summary tables (2026-09-25)

These sources used to keep a small slice of their records. Both now pull
every record and summarize it at pull time, keeping only the tables
agents need. None of the earlier limits were API cost: pulls are free,
and the model only ever sees computed facts.

**Medicare Physician & Other Practitioners** (`data/adapters/physicianByProviderSummary.ts`)
replaces the 5-state "by Provider and Service" sample. That sample was
the first 1,000 rows per state in API order: 560 providers in total, all
with NPIs between 1003000639 and 1003432022, not a representative sample.
The replacement reads CMS's "by Provider" file, one row per provider,
about 1.3 million a year, for every data year CMS publishes (2013 onward,
each year its own dataset id in CMS's catalog). Verified live 2026-09-25:
5,000 rows per request, and `column=` returns only the named fields. It
stores state × provider type and state × rurality totals per year, plus
the top 100 providers by payment. Past years are pulled once and cached,
and a new data year is picked up from the catalog automatically. The
first backfill took about 18 minutes. One page request dropped its
connection mid-backfill and succeeded on retry seconds later, so retries
now back off for up to about 3 minutes.

**NIH RePORTER** keeps its top-100 awards list and adds a `summary` of
every award in the window by month, month × administering institute,
state, activity code and funding mechanism. Verified live 2026-09-25:
500 records per request at most, offsets of 15,000 or more are rejected,
and sorting by `appl_id` (returned when requested as "ApplId") gives
stable pages. The adapter pages one month at a time and halves any range
over the cap. August 2025 had 15,138 awards and needed the split. The
first pull captured 140,718 notices, $79.47B.

**Marketplace Rate and Plan Attributes PUFs** (`data/adapters/marketplaceRatePuf.ts`)
replaces the 5-state, age-21 sample. Verified live 2026-09-25: CMS links
both files for every plan year from 2014. The Rate PUF has no plan-type
columns, so it is joined to Plan Attributes (`StandardComponentId` =
Rate PUF `PlanId`) to keep only on-exchange individual medical plans;
the old sample had mixed in dental plans. The 2014 Rate PUF unzips to
722MB, so the adapter streams it; columns are found by header name
because order and quoting change by year. About 6-10 seconds and 55KB
per plan year.

**Medicare Physician & Other Practitioners by service** (`data/adapters/physicianServiceSummary.ts`)
pulls only the national rows of CMS's "by Geography and Service" file for
every data year. Verified live 2026-09-25: `filter[Rndrng_Prvdr_Geo_Lvl]=National`
returns 13,463 of 268,350 rows for 2024, so a year is 3 requests. Service
categories come from CMS's Restructured BETOS Classification System (RBCS,
20,081 rows); each code's latest assignment is used for every year. The
first object-based storage came to 31MB for 12 years, so rows are stored
as arrays in whole dollars, with descriptions once in `codes.json`, about
7.7MB in total.

**MA/Part D Monthly Enrollment by Plan** (`data/adapters/maPartDHistory.ts`)
keeps its latest-month snapshot and adds a summary for every month CMS
lists. Verified live 2026-09-25: the index paginates with `?page=N` and
listed 37 months, 2023-08 through 2026-09, each a zip in the same format.
Each month is stored as totals by segment (Medicare Advantage, standalone
Part D, other), by parent organization and by plan type, about 10 KB per
month. One 2024 file's header read `Enrollment ` with a trailing space,
so header matching now trims whitespace and a byte-order mark.

### Facility capacity and ownership (added 2026-09-25, session B)

**Provider of Services files** (`data/adapters/providerOfServices.ts`)
replace the Market Growth agent's capacity proxy (a hospital count from one
Hospital General Information snapshot) with certified beds and a history.
CMS publishes two catalog entries. The QIES file has the fourth quarter of
2011-2017, then every quarter from 2018-Q4; the iQIES file starts 2023-Q4.
Verified live 2026-09-25, provider types moved from QIES to iQIES in waves
(home health, hospice and surgery centers 2023-Q4; nursing homes 2025-Q3;
dialysis, ICF/IID and therapy clinics after), and no type was in both files
in the same quarter. Each quarter takes each type from the file that has it,
so nothing is double counted. Nursing home beds moved -0.3% at the switch,
against a typical 0.2% quarterly move. Two defects are skipped automatically:
QIES froze home health (11,506 from 2021-Q4) and surgery center counts
before the move, and the 2020-Q1 and 2020-Q2 QIES files were incomplete.
Summaries are active facilities and certified beds by state and type per
file-quarter, plus dated openings and closures by termination reason: 49
files, 1.4MB. Trends compare fourth-quarter files.

**Change of ownership** (`data/adapters/facilityOwnership.ts`): hospital
and SNF releases are cumulative back to 2016, so only the latest is kept
whole. A year keeps filling in for 12-18 months: SNF changes effective
2024 were 69 in the 2024-Q2 release, 420 in 2025-Q2 and 741 in 2026-Q2.
Every past release's counts by effective year are stored, and years are
only compared at the same reporting lag. Owner information files name each
buyer's 5%-or-greater organization owners, which turns single-facility SNF
LLCs into their parent chains.

**All Owners, private equity flag**: the field exists only from 2025-04
(hospitals) and 2024-11 (SNFs). The data API silently ignores a filter on
a column a release lacks and returns every row, so each release's columns
are checked first. Owner association dates show most of the flag's growth
is older ownership being reported, not new deals. Owner rows with no
organization name (people) are never named.

### The 4 newest sources (added 2026-09-24, for the 12th agent - Market/Catalyst Intelligence)

All 4 are a fundamentally different source family from the six above -
corporate-disclosure, drug-approval, federal-grant, and clinical-trial
data, not CMS program data - added for the new Market/Catalyst
Intelligence agent (see `AGENT_ARCHITECTURE.md` §13). All 4 originally
used a 150-day rolling window, widened 2026-09-24 to a real 730-day
(2-year) window per Adam's request for deeper historical coverage -
openFDA's request limit was raised (100→1000) and ClinicalTrials.gov
gained real pagination to safely cover the larger real population this
surfaces (see each adapter's own header for the live-verified counts
behind these changes). Pulled quarterly like every other adapter.

**SEC EDGAR 8-K filings** (`data/adapters/secEdgarFilings.ts`) - the
`data.sec.gov/submissions/CIK{...}.json` endpoint for a fixed, hardcoded
6-company watchlist (UnitedHealth Group, CVS Health, Humana, Centene, The
Cigna Group, Elevance Health), each CIK independently verified live
2026-09-24 to return the correct company name. Real response shape is
parallel arrays under `filings.recent` (not an array of objects) -
`form`, `filingDate`, `items` (a comma-separated string, not an array),
etc. Requires a real, descriptive `User-Agent` header per SEC's own
documented fair-access policy (not optional). **Verified real finding
(not assumed):** Item 5.02 (7 real filings across 3 of the 6 companies
this window) covers both departure AND appointment of officers/directors
- this project never characterizes one as a firing or resignation. Item
1.01 (1 real filing, Humana) covers far more than partnerships. Bounded
to this 6-company watchlist only, never the full health-insurance sector.

**openFDA novel drug approvals** (`data/adapters/fdaDrugApprovals.ts`) -
`api.fda.gov/drug/drugsfda.json`, filtered to `submission_class_code`
containing "TYPE 1" (new molecular entity) and `submission_status: AP`
within the window. **Real gotcha confirmed live:** the search matches at
the application level, so a single application can bundle in unrelated
submissions outside the requested window (verified with a real example:
application BLA761467/KEYTRUDA QLEX matched on its real 2025-09-19 ORIG
approval but also carried 10 unrelated SUPPL submissions, some dated in
2026) - this adapter re-filters per-submission rather than trusting
application-level inclusion. No "breakthrough therapy" field exists in
this dataset; only `submission_class_code` and `review_priority` are used
verbatim. `datasetVintage` uses the API's own real `meta.last_updated`
field.

**NIH RePORTER award notices** (`data/adapters/nihReporterAwards.ts`) -
`POST api.reporter.nih.gov/v2/projects/search`. **Real gotcha confirmed
live:** the response always comes back in the API's own snake_case/nested
shape (`project_num`, `organization.org_name`, `agency_code`,
`award_notice_date`) regardless of the PascalCase `include_fields` named
in the request - this adapter parses the real shape, not the requested
one. **Real correction vs. this project's original plan:** the real
`agency_code` field is the sponsoring HHS operating division/agency
(verified live values: "NIH", "FDA", "ALLCDC"), NOT NIH institute/
center-level detail (NHLBI/NCI/NIA) as originally assumed - the agent's
Q115 insight was labeled "by funding agency" for this reason until
2026-09-25, when the full-population summary switched it to the
administering-institute field `agency_ic_admin`, which does carry
institute detail. The top-100 awards list is still kept for naming
specific awards; totals come from the full summary (see above).

**ClinicalTrials.gov Phase 3 results** (`data/adapters/clinicalTrialsResults.ts`)
- `clinicaltrials.gov/api/v2/studies`, `AREA[Phase]PHASE3` +
`AREA[ResultsFirstPostDate]RANGE[...]`. **Real shape confirmed live:** the
requested flat field names (NCTId, BriefTitle, etc.) are the correct,
case-sensitive v2 field names, but the response nests each one under its
real module (`protocolSection.identificationModule.nctId`,
`.sponsorCollaboratorsModule.leadSponsor.{name,class}`, etc.), not as a
flat top-level key - this adapter parses that real nested shape. Filters
to `leadSponsor.class === "INDUSTRY"` only, at the adapter level (the
most executive-relevant subset). A results posting on this dataset
encodes no success/failure judgment - this project never says "positive
result," only that results were posted, by whom, with what real
enrollment number.

The first two are the CMS Provider Data Catalog's own Datastore API —
public, unauthenticated, paginated, no API key required. The third
(added Phase 5 addendum, 2026-09-23, after Adam pointed out the dashboard
only ever referenced provider-directory data, never claims or payment
data) is CMS's separate general Datastore v1 API
(`data.cms.gov/data-api/v1/dataset/{id}/data`) - a different platform,
independently verified rather than assumed to work the same way. It's
the first source with real submitted-charge/Medicare-payment/
provider-type fields, and its state-level breakdown overlapping with
Hospital General Information's is what makes the Emerging Trends agent's
real cross-dataset correlation insight possible (`AGENT_ARCHITECTURE.md`
section 10). Sample is bounded to 5 states (WA, CA, TX, NY, FL), up to
1,000 rows each - the full national file is tens of millions of rows and
produced a 112MB snapshot in initial testing, impractical to commit to a
public repo; see `cms-intelligence/data/adapters/
physicianOtherPractitioners.ts` for the full rationale.

All six have a real adapter, real committed snapshot data, and at
least one domain agent computing a real insight from them (see
`AGENT_ARCHITECTURE.md` and each agent's own file). The fourth (added
2026-09-23, per Adam's stated data-source priority order) is the Federal
Register API filtered to CMS as the publishing agency — the first real
source for the previously-stub Policy, Regulation & CMS Program
Intelligence agent, and the reason the "Policy & Program Watch" dashboard
layer is no longer empty. Each pull is bounded to a trailing 730-day
(2-year) publication window (widened 2026-09-24 from 120 days per Adam's
request for deeper historical coverage - a real, live-verified single
request via a raised per_page cap, not full regulatory history) — see
`cms-intelligence/data/adapters/federalRegisterDocuments.ts` for the
exact query and rationale. The agent's deterministic code covers rule-
cycle tracking (finalized vs. proposed vs. upcoming-effective — Q074,
Q075, Q076); which specific domain a rule routes to (Q077–Q080) is
explicitly this agent's LLM step per `AGENT_ARCHITECTURE.md` and stays
unimplemented until a live model provider is wired in, rather than
guessed at.

The fifth (added 2026-09-23, second in the priority order) is CMS's
Monthly Enrollment by Plan file for Medicare Advantage/Part D — a
different platform entirely from the other four (a monthly zip, not a
query API; the adapter re-discovers the real download URL at pull time
by crawling CMS's real page structure, since the URL itself changes
every month). This is the first real source for the previously-stub
Medicare Advantage & Part D Intelligence agent. **Privacy/naming design
decision, revised 2026-09-24**: the raw file names a real organization/
plan on every row. The adapter keeps `Parent Organization` and
`Organization Marketing Name` (the two fields a real market-share rollup
needs) but still drops lower-level plan/contract fields (Organization
Name, Plan Name, Contract Number, Plan ID) it has no real use for. A real
carrier name reaching an insight is allowed when — and only when — it's a
genuine, sourced finding computed from this real data (e.g. "which parent
organization leads MA enrollment," the same kind of ranking a real
industry directory like AIS Health publishes) — see
`medicare-advantage-part-d/agent.ts`'s `buildParentOrganizationRankingSignal`.
This is also this repo's first binary-format (zip) data source — the
`fflate` package was added specifically for this, the project's first
parsing dependency of any kind.

The sixth (added 2026-09-23, final item in the priority order — T-MSIS/
Medicaid stays deprioritized as most fragmented) is CMS's ACA Marketplace
Rate PUF. Two real findings shaped this adapter: (1) the file only
covers Federally-Facilitated Marketplace states — WA, CA, and NY run
their own State-Based Exchanges and are structurally absent from it, so
this project's usual WA/CA/TX/NY/FL sample couldn't be reused; the 5
sampled states here (FL, MI, OH, TX, SC) are instead the 5 largest FFM
states by real row count in the file. (2) The real, ~280MB national CSV
contains 67 rows at exactly `IndividualRate=9999` and 1,129 at exactly
`0` — both excluded as a disclosed empirical judgment (clear statistical
outliers), not because CMS's own Rate PUF data dictionary documents
either as an official placeholder (it was read directly and does not).
Unlike MA/Part D (which has a literal organization-name string in the raw
file), this file's issuer field is an opaque numeric HIOS ID with no
literal name attached — turning that into a real carrier name would need
a separately-sourced, verified CMS issuer-ID-to-company crosswalk, which
this project doesn't have wired in. Rather than guess at a mapping and
risk attaching the *wrong* real company to a real number (a worse failure
than not naming anyone), IssuerId is used only as a real COUNT of
distinct issuers (added 2026-09-24 - see the redesign note in
`commercial-marketplace/agent.ts`'s header, fixing a real degenerate-tie
bug in the prior rating-area-level plan-count metric), never surfaced or
resolved to a name; PlanId is similarly kept only as an opaque identifier
used solely as a distinct-plan **count**. A real name crosswalk would be
a legitimate future step (see `app/healthcare-intelligence/page.tsx`'s
case study future-state note), not a rule against naming carriers from
this file in principle.

A third dataset in the same catalog family — **Hospice - General
Information** (`yc9t-dgbk`) — was *seen* in the same live metastore
lookup but its datastore query endpoint has not been called yet, so it's
listed below as a candidate, not verified — seeing an ID in a listing is
not the same as confirming the live query and field names, and this
registry only promotes an entry once both have actually happened.

## Candidates (not yet verified)

The remaining entries below are named in
`04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`'s source-family lists. Each
carries honest, general metadata (what CMS is known to publish in that
family, which questions it would serve) with every specific field
(exact URL, dataset ID, vintage, grain) explicitly `null`/"unverified"
until someone actually queries it live — see
`cms-intelligence/data/sources/registry.ts` for the full field-level
detail per entry, not reproduced here to avoid this document drifting out
of sync with the code.

| Source ID | Name | Family | Related questions |
|---|---|---|---|
| `cms:medicare-inpatient-hospitals` | Medicare Inpatient Hospitals | Utilization/claims | Q018, Q019 |
| `cms:medicare-outpatient-hospitals` | Medicare Outpatient Hospitals | Utilization/claims | Q018–Q020 |
| `cms:hospice-general-information` | Hospice - General Information | Post-acute (seen live, not yet queried) | Q021 |
| `cms:t-msis` | T-MSIS / TAF (Medicaid) | Medicaid | Q056–Q058 |
| `cms:shared-savings-program` | Shared Savings Program (ACO) | Value-based care | Q102–Q104 |

This list is intentionally not exhaustive against every dataset named in
the master orchestrator's Phase 4 source list — provider ecosystem
(ownership, taxonomy, revalidation), the remaining post-acute families
(SNF, IRF, LTCH, DMEPOS), and the remaining payment families (IPPS, OPPS,
ASC, MA ratebooks, Drug Price Negotiation) are real, named next
candidates for whenever the vertical slice expands, not implemented or
even individually cataloged yet — cataloging placeholder entries for
~30 more unverified datasets with no new information beyond "CMS
publishes this" would add volume without adding honesty or usefulness.
Add an entry here (and in `registry.ts`) when a specific one is actually
being investigated.

## Acceptance criteria check

Per the phase doc: "every source must map to at least one executive
question" and "every source should map back to one or more questions" —
enforced in code, not just by convention: see
`cms-intelligence/data/sources/registry.test.ts`'s assertion that every
registry entry has a non-empty `relatedQuestionIds` array.

## SEC EDGAR 8-K filings, every health-industry SIC code (added 2026-09-25)

`sec-edgar:health-industry-8k` · `data/adapters/secHealthIndustry8k.ts` ·
Market Catalyst agent, Q160–Q162 · pulled monthly, trailing 730 days.

Widens the 6-insurer watchlist (`sec-edgar:healthcare-8k-filings`, which
keeps running unchanged) to every company in a health SIC code, tracking
Items 1.01 (material definitive agreement), 2.01 (completion of
acquisition or disposition of assets) and 5.02 (director/officer
departure or election).

**Health SIC codes**, checked 2026-09-25 against SEC's own list
(sec.gov/search-filings/standard-industrial-classification-sic-code-list):

| Sector | SIC codes |
|---|---|
| Pharma & biotech | 2833, 2834, 2835, 2836 |
| Medical devices & supplies | 3841, 3842, 3843, 3844, 3845, 3851 |
| Drug & supply distribution, pharmacies | 5047, 5122, 5912 |
| Health insurers | 6324 |
| Hospitals & health services | 8000, 8011, 8050, 8051, 8060, 8062, 8071, 8082, 8090, 8093 |

Left out: 6321 (accident & health insurance) and 8731 (commercial
physical & biological research), because most registrants there are
disability/supplemental insurers or non-medical labs.

**Primary path: EDGAR full-text search**
(`efts.sec.gov/LATEST/search-index?forms=8-K&sics=…&startdt=…&enddt=…&from=…`).
Verified live 2026-09-25: one hit per filing, `_source` carries `ciks`,
`display_names`, `sics`, `items`, `form`, `file_date`, `adsh`; 57 hits for
SIC 8062 in 2026. Pages hold 100 hits and a query stops counting at
10,000 (SIC 2834 alone had 13,259 in the window), so each SIC is queried
in quarter-sized date ranges, halved at the cap. `forms=8-K` also returns
8-K/A amendments, which are dropped.

**Real gotcha found live:** `sics` is undocumented and SEC's CDN cache
ignores it (and parameter order, and unknown parameters). A request for
SIC 3841 came back with SIC 5912's cached answer, and every SIC briefly
returned the same 438 hits. The response echoes the query that actually
ran, so the adapter checks every page's echoed SIC, dates and offset,
retries once, then splits the date range to get a fresh cache key. Each
SIC's ranges also start on different days, so the SICs never share keys.

**Fallback (documented path):** daily form index
(`Archives/edgar/daily-index/YYYY/QTRn/form.YYYYMMDD.idx`) for every 8-K
filer, then each CIK's `data.sec.gov/submissions/CIK##########.json` for
its SIC and items. Used automatically if full-text search errors or the
echo check fails at a single day. Several thousand requests, about 20
minutes.

**First pull (2026-09-26 UTC):** 25,894 original 8-Ks from 1,234
companies; 4,389 with Item 1.01, 470 with Item 2.01, 4,376 with Item 5.02.
**Cross-check:** the six watchlist insurers' 8-K, 1.01, 2.01 and 5.02
counts match the submissions API exactly. Requests are spaced 150ms
apart (under SEC's 10/second) with the same descriptive User-Agent as
the watchlist adapter. Summarized at pull time (164KB): counts by SIC and
month and by company, plus every Item 2.01 filing with its link.

## SEC Form D data sets, health-care issuers (added 2026-09-25)

`sec-edgar:form-d-health` · `data/adapters/secFormD.ts` · Market Catalyst
agent, Q163–Q165 · pulled monthly; SEC publishes quarterly.

Form D is the notice filed within 15 days of first selling securities in
an exempt offering: venture and growth rounds, but also private
placements by listed companies and debt. Quarterly zips are linked from
`sec.gov/data-research/sec-markets-data/form-d-data-sets`. The link path
changed between quarters (2026q2 under `/files/datastandardsinnovation/`,
earlier under `/files/structureddata/`), so the adapter reads the links
from the page each pull.

`FORMDSUBMISSION.tsv`, `OFFERING.tsv` and `ISSUERS.tsv` (primary issuer)
are joined by `ACCESSIONNUMBER`; columns are found by header name.
Health care is the form's five health industry groups: Biotechnology,
Pharmaceuticals, Health Insurance, Hospitals and Physicians, Other Health
Care. Health-focused investment funds file as pooled investment funds and
are not included. Verified: 2026 Q2 had 555 health-care filings (465 D,
90 D/A), and the 2024 Q3 file has the same columns.

**Amendments:** a D/A restates an earlier notice and `TOTALAMOUNTSOLD` is
cumulative, so each D/A is followed back through `PREVIOUSACCESSIONNUMBER`
to its original D. An offering counts once, in its original notice's
quarter, at the amount sold in its latest amendment. Amendments to notices
filed before the window restate older offerings and are left out.

**Window:** the latest 8 quarterly files (two full years), the closest
match to the other Market Catalyst sources' 730 days. **First pull:**
2024 Q3–2026 Q2, 3,899 health-care filings: 3,221 offerings, 363
amendments folded in, 315 amendments to earlier offerings left out;
$39.99B sold. Summarized at pull time (31KB): by quarter and industry
group, by issuer state, and the 50 largest offerings.
