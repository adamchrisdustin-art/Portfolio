# Source Registry — Healthcare Intelligence Executive Dashboard

Phase 4 deliverable per `04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`. This is
the human-readable view of `cms-intelligence/data/sources/registry.ts` —
that file is the source of truth (imported by code); this document exists
so a reader doesn't have to open TypeScript to understand what's tracked.

## How entries are verified, and why most aren't yet

Per the master orchestrator's "never invent a source" rule, extended here
to the registry itself: a source only gets specific details (real URL,
confirmed vintage, confirmed field names) once it's actually been
live-queried, not because it's plausible or well-known. Five sources have
been verified this way. Every other source named in
`04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`'s six source families is listed as
a **candidate** — real family/population/topic, honestly marked
unverified rather than filled in with a guessed dataset ID or URL.

## Verified & implemented (5 sources)

| Source ID | Name | Real endpoint | Verified | Related questions |
|---|---|---|---|---|
| `cms:hospital-general-information` | Hospital General Information | `data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0` | 2026-09-23 | Q001, Q004, Q006, Q036, Q037, Q038 |
| `cms:home-health-care-agencies` | Home Health Care Agencies | `data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0` | 2026-09-23 | Q011, Q012, Q021, Q036 |
| `cms:medicare-physician-other-practitioners` | Medicare Physician & Other Practitioners - by Provider and Service | `data.cms.gov/data-api/v1/dataset/92396110-2aed-4d63-a6a2-5d6207d46a29/data` | 2026-09-23 | Q011, Q012, Q026, Q027, Q028, Q031, Q088 |
| `federal-register:cms-documents` | Federal Register - CMS documents | `federalregister.gov/api/v1/documents.json` | 2026-09-23 | Q073, Q074, Q075, Q076 |
| `cms:ma-part-d-enrollment` | MA/Part D Monthly Enrollment by Plan | `cms.gov/.../medicare-advantagepart-d-contract-and-enrollment-data/monthly-enrollment-plan` | 2026-09-23 | Q049, Q053 |

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

All five have a real adapter, real committed snapshot data, and at
least one domain agent computing a real insight from them (see
`AGENT_ARCHITECTURE.md` and each agent's own file). The fourth (added
2026-09-23, per Adam's stated data-source priority order) is the Federal
Register API filtered to CMS as the publishing agency — the first real
source for the previously-stub Policy, Regulation & CMS Program
Intelligence agent, and the reason the "Policy & Program Watch" dashboard
layer is no longer empty. Each pull is bounded to a trailing 120-day
publication window (not full regulatory history) — see
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
Medicare Advantage & Part D Intelligence agent. **Binding privacy/naming
design decision**: the raw file names a real organization/plan on every
row; per CLAUDE.md's rule against naming specific real carriers (e.g.
UnitedHealthcare/Optum) anywhere on the public site, the adapter drops
every named field before it's ever persisted to a snapshot — only
category fields (Organization Type, Plan Type, Offers Part D) exist
downstream of the adapter, so no agent can name a real carrier even by
accident. This is also this repo's first binary-format (zip) data
source — the `fflate` package was added specifically for this, the
project's first parsing dependency of any kind.

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
| `cms:marketplace-puf` | Exchange / Marketplace PUFs | Enrollment/market structure | Q066–Q068 |
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
