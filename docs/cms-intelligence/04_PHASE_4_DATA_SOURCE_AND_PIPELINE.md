# PHASE 4 — CMS DATA, SOURCE GOVERNANCE & ANALYTICAL PIPELINE

## Claude Code task

Build a public-data-first healthcare intelligence data layer.

## Source philosophy

Use CMS as the primary external data backbone.

Use other public sources where they materially improve the question.

Never use a source merely because it exists.

Every source must map to at least one executive question.

## Initial CMS source families

Investigate and catalog the current versions of:

### Utilization / claims-derived

- Medicare Physician & Other Practitioners
- Medicare Inpatient Hospitals
- Medicare Outpatient Hospitals
- Hospital Service Area
- Medicare Part D Prescribers
- DMEPOS
- Home Health
- Hospice
- Skilled Nursing Facility
- IRF
- LTCH
- other relevant post-acute files

### Enrollment / market structure

- Medicare Monthly Enrollment
- MA / Part D contract and enrollment
- MA county penetration
- MA service areas
- MA plan benefits
- Part D enrollment
- Exchange / Marketplace effectuated enrollment
- Exchange plan/rate/benefit/service-area PUFs
- Exchange quality data
- other relevant marketplace files

### Provider ecosystem

- Medicare provider enrollment
- provider characteristics
- ownership
- provider taxonomy
- revocation/revalidation
- facility/provider datasets

### Payment / reimbursement

- Physician Fee Schedule
- IPPS
- OPPS
- ASC
- SNF PPS
- IRF PPS
- LTCH PPS
- Home Health PPS
- Hospice
- DMEPOS
- MA ratebooks
- Part D payment information
- Drug Price Negotiation

### Value-based care

- Shared Savings Program
- ACO participation
- ACO performance
- ACO expenditure/risk
- Innovation Center models
- relevant CMMI program datasets

### Medicaid

Investigate public Medicaid enrollment and T-MSIS/TAF resources.

Clearly label access-restricted resources.

## Source registry

Create a structured registry containing:

- source_id
- source_name
- owner
- URL/API
- dataset description
- population
- geography
- grain
- latest vintage
- publication date
- update frequency
- expected next update
- identifiers
- join keys
- historical coverage
- restrictions
- known suppression
- known limitations
- methodology notes
- last verified
- last schema check
- change status

## Source monitor

The system must be able to identify:

- new dataset
- updated dataset
- schema change
- definition change
- methodology change
- historical revision
- delayed release
- retired source
- replacement source

Create source-change records.

## Data pipeline requirements

For each implemented source:

1. discover metadata
2. fetch or load sample
3. validate schema
4. normalize types
5. map dimensions
6. record provenance
7. calculate required metrics
8. store/update source status
9. expose analytical data to agents

## Public-data-first architecture

Create adapters that can later accept internal UHC/Optum-like datasets without embedding proprietary assumptions.

Example interfaces:

```text
MembershipAdapter
ClaimsAdapter
ProviderAdapter
ReimbursementAdapter
PharmacyAdapter
NetworkAdapter
```

For the portfolio, these may be backed by:

- public CMS data
- synthetic datasets
- static fixtures

## Provenance

Every calculated metric must retain:

- source dataset
- source vintage
- period
- transformation
- calculation
- refresh date

## Data quality

Create checks for:

- missing fields
- duplicate identifiers
- unexpected category values
- impossible dates
- unexplained volume changes
- schema drift
- unexpected geographic loss
- suspicious joins

## Required outputs

Create documentation for:

- source registry
- source ingestion
- schema mapping
- data lineage
- data quality rules

Implement at least one real CMS data path end-to-end before expanding broadly.

## Acceptance criteria

At least one executive question should be answered using real public CMS data, with the source, transformation, calculation, and resulting insight all traceable.
