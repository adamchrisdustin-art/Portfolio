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

## Verified & implemented (10 sources)

| Source ID | Name | Real endpoint | Verified | Related questions |
|---|---|---|---|---|
| `cms:hospital-general-information` | Hospital General Information | `data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0` | 2026-09-23 | Q001, Q004, Q006, Q036, Q037, Q038 |
| `cms:home-health-care-agencies` | Home Health Care Agencies | `data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0` | 2026-09-23 | Q011, Q012, Q021, Q036 |
| `cms:medicare-physician-by-provider` | Medicare Physician & Other Practitioners - by Provider (every provider, 2013 onward, summarized) | `data.cms.gov/data-api/v1/dataset/{per-year id}/data` | 2026-09-25 | Q011, Q012, Q013, Q014, Q026, Q027, Q031, Q088 |
| `federal-register:cms-documents` | Federal Register - CMS documents | `federalregister.gov/api/v1/documents.json` | 2026-09-23 | Q073, Q074, Q075, Q076 |
| `cms:ma-part-d-enrollment` | MA/Part D Monthly Enrollment by Plan | `cms.gov/.../medicare-advantagepart-d-contract-and-enrollment-data/monthly-enrollment-plan` | 2026-09-23 | Q049, Q053 |
| `cms:marketplace-rate-puf` | Marketplace (Exchange) Rate PUF | `cms.gov/marketplace/resources/data/public-use-files` | 2026-09-23 | Q067, Q071 |
| `sec-edgar:healthcare-8k-filings` | SEC EDGAR 8-K filings, health-insurer watchlist | `data.sec.gov/submissions/CIK{10-digit}.json` | 2026-09-24 | Q120, Q121, Q122 |
| `openfda:drugsfda-novel-approvals` | openFDA drugsfda - novel (Type 1) drug approvals | `api.fda.gov/drug/drugsfda.json` | 2026-09-24 | Q117, Q118, Q119 |
| `nih-reporter:project-awards` | NIH RePORTER - project award notices | `api.reporter.nih.gov/v2/projects/search` | 2026-09-24 | Q113, Q114, Q115, Q116, Q129 |
| `clinicaltrials-gov:phase3-results` | ClinicalTrials.gov - Phase 3 results postings | `clinicaltrials.gov/api/v2/studies` | 2026-09-24 | Q123, Q124 |

### Full-population summary tables (2026-09-25)

Two sources used to keep a small slice of their records. Both now pull
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

**MA/Part D Monthly Enrollment by Plan** (`data/adapters/maPartDHistory.ts`)
keeps its latest-month snapshot and adds a summary for every month CMS
lists. Verified live 2026-09-25: the index paginates with `?page=N` and
listed 37 months, 2023-08 through 2026-09, each a zip in the same format.
Each month is stored as totals by segment (Medicare Advantage, standalone
Part D, other), by parent organization and by plan type, about 10 KB per
month. One 2024 file's header read `Enrollment ` with a trailing space,
so header matching now trims whitespace and a byte-order mark.

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
| `cms:physician-fee-schedule` | Physician Fee Schedule | Payment/reimbursement | Q026–Q028 |

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
