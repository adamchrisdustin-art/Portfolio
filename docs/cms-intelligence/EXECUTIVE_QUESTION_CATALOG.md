# Executive Question Catalog — Healthcare Intelligence Executive Dashboard

Phase 2 deliverable per `02_PHASE_2_INTELLIGENCE_BLUEPRINT.md` §1. Written to
`docs/cms-intelligence/` rather than the template's `docs/healthcare-intelligence/`
path, consistent with the path adaptation already documented in
`REPOSITORY_DISCOVERY.md` from Phase 1.

This is a catalog of **executive questions**, not a list of metrics. Every
row exists because a leader would plausibly ask it, not because a dataset
happens to support it.

## How to read this catalog

Each of the 12 categories below opens with a **Dimensions block** — the
population, geography, time horizon, required data, and likely source that
apply to *every* question in that category by default. Individual questions
then get their own row with the fields that genuinely vary
question-to-question: the question itself, why leadership needs it / the
decision it supports, the leading indicator, the lagging indicator, and any
limitation that's *more specific* than the category's general limitation.

This inheritance pattern (category defaults + per-question deltas) is a
deliberate choice over repeating all ten fields on all 112 rows — the
repeated fields really are stable within a category, and restating them
per-row would bury the parts that actually differentiate one question from
the next. Every question still has all ten fields; nine of them are just
declared once per category instead of 112 times.

**General limitation that applies everywhere in this catalog** (stated once,
not repeated per category): every source here is public CMS data (or another
named public source). None of it is UnitedHealthcare/Optum-specific,
proprietary, or PHI. Where a question is really asking about *internal*
performance, the public data source is a **benchmark/proxy**, not a
substitute — the dashboard must never imply otherwise. Questions that
cannot be reasonably answered even as a proxy are moved to
`DATA_GAP_REGISTER.md` instead of listed here with a source that doesn't
really support them.

Question IDs are `Q001`–`Q112` (the original 112-question catalog) plus
`Q113`–`Q124` (Market/Catalyst Intelligence, added 2026-09-24 — see §13),
and are the join key `question_id` used by `EVIDENCE_MODEL.md` and
referenced by `AGENT_ARCHITECTURE.md`.

---

## 1. Market & growth (Q001–Q010)

**Dimensions:** Population — Medicare FFS beneficiaries and providers (public-data-first; MA/Medicaid/Marketplace population noted per-question where it differs). Geography — county / state / CBSA (Core-Based Statistical Area). Time horizon — rolling 12–24 months, year-over-year. Required data — enrollment counts, utilization counts, and provider counts by geography and time. Likely source — CMS Monthly Enrollment, Medicare Physician & Other Practitioners, Hospital Service Area, Medicare Inpatient/Outpatient.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q001 | Which markets are growing fastest? | Where to prioritize network investment or GTM focus | New provider enrollments in a geography | Realized enrollment/utilization growth | — |
| Q002 | Which markets are accelerating? | Distinguishes "still growing" from "growing faster" — timing for investment | Change in the growth *rate*, not the level | Confirmed multi-quarter acceleration | Needs ≥3 periods to compute a second derivative reliably |
| Q003 | Which markets are slowing? | Early warning before a market shows outright decline | Deceleration in leading enrollment/utilization signals | Confirmed YoY decline | — |
| Q004 | Where is enrollment changing? | Base input to almost every other market question | Monthly enrollment file deltas | Quarterly/annual enrollment totals | Enrollment files are the most current public signal CMS publishes — treat as the fastest-moving input |
| Q005 | Where is healthcare utilization growing faster than population? | Signals rising per-capita demand, not just population growth | Utilization-per-1,000 trend vs. population growth trend | Confirmed divergence over ≥2 periods | Requires both a utilization source and a population source with matching geography |
| Q006 | Where is provider capacity growing? | Supply-side read on a market's growth story | New provider enrollments, new facility openings | Sustained facility/provider count growth | — |
| Q007 | Where are provider and population growth diverging? | Flags future access strain or oversupply | Ratio of provider growth rate to population growth rate | Realized access metrics (e.g., wait times) — not publicly available, flag as proxy-only | Access/wait-time data itself is a data gap (see `DATA_GAP_REGISTER.md`) |
| Q008 | Which markets show simultaneous growth across multiple dimensions? | Highest-confidence growth signal — corroborated, not single-source | Two or more leading indicators moving together | Two or more lagging indicators confirming | Requires cross-dataset join on consistent geography |
| Q009 | Which markets are seeing unusual service-line expansion? | New/shifting competitive positioning in a market | New CPT/HCPCS categories appearing in a geography's claims mix | Sustained volume in the new category | — |
| Q010 | Which markets are changing product mix? | Signals a shift leadership should plan around (e.g., MA growth outpacing FFS) | Early shift in enrollment mix by product line | Confirmed multi-period mix shift | Product-mix comparisons must not equate FFS, MA, and Medicaid populations (see Metric Dictionary "population" rule) |

## 2. Claims & utilization (Q011–Q025)

**Dimensions:** Population — Medicare FFS (public claims-derived data; this is the primary public-data constraint for this category — real multi-payer claims aren't publicly available). Geography — national / state / HRR (Hospital Referral Region) where the source supports it. Time horizon — quarterly/annual, trailing 3–5 years for trend work. Required data — utilization counts by service (HCPCS/DRG), site of care, and spend. Likely source — Medicare Physician & Other Practitioners, Medicare Inpatient, Medicare Outpatient, Hospital Service Area.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q011 | Which services have the fastest utilization growth? | Where volume-driven investment/staffing should follow | Early quarter-over-quarter volume uptick | Confirmed YoY volume growth | — |
| Q012 | Which services have the fastest cost growth? | Distinguishes volume growth from cost growth — different responses | Early per-service allowed-cost uptick | Confirmed YoY cost growth | Never equate billed charges with allowed/paid reimbursement |
| Q013 | Which categories are growing because of volume? | Decomposition needed before any pricing/staffing response | Volume component of a growth decomposition | Confirmed sustained volume-driven growth | Requires a volume/price/mix decomposition method — see Metric Dictionary "growth" |
| Q014 | Which are growing because of price? | Different lever than volume — pricing/negotiation response | Price component of a growth decomposition | Confirmed sustained price-driven growth | Public FFS rates are set by CMS, not negotiated — "price growth" here means fee-schedule/rate changes, not market negotiation |
| Q015 | Which are growing because of intensity? | Signals acuity/complexity shift, not just more visits | Intensity component (e.g., RVU per encounter) | Confirmed sustained intensity growth | — |
| Q016 | Which are growing because of mix? | Signals shift toward higher/lower-value services | Mix component of decomposition | Confirmed sustained mix shift | — |
| Q017 | Which conditions drive the change? | Ties a cost/utilization signal to a clinical story leadership can act on | Diagnosis-mix shift in early data | Confirmed condition-level driver | Public data ties conditions to claims loosely (DRG/HCPCS proxies), not full clinical detail |
| Q018 | Which services are moving between sites of care? | Site-of-care shift changes cost and network strategy | Early site-of-care mix change | Confirmed multi-period site-of-care shift | — |
| Q019 | What is moving from inpatient to outpatient? | Classic, well-precedented site-of-care shift with direct cost implications | Early outpatient volume growth in a service category | Confirmed inpatient volume decline paired with outpatient growth | — |
| Q020 | What is moving from facility to ASC? | ASC shift affects both cost and competitive dynamics | Early ASC volume growth in a service category | Confirmed facility-to-ASC volume shift | — |
| Q021 | What is moving to home? | Home-based care shift is an emerging, strategically important pattern | Early home-health/home-infusion volume growth | Confirmed sustained shift to home setting | Public home-care utilization detail is thinner than facility-based data |
| Q022 | Which trends are persistent? | Filters signal from noise before leadership acts | N/A — this question evaluates other signals | ≥2 consecutive periods confirming direction (per Trend Framework) | See `TREND_FRAMEWORK.md` persistence rule |
| Q023 | Which trends are seasonal? | Prevents mistaking a seasonal pattern for a real trend | Same-period-last-year comparison | Multi-year seasonal pattern confirmed | See `TREND_FRAMEWORK.md` seasonality rule |
| Q024 | Which trends are anomalies? | Flags one-time events vs. real shifts | Statistical outlier vs. rolling baseline | Confirmed one-time (non-repeating) event | See `TREND_FRAMEWORK.md` anomaly-threshold rule |
| Q025 | Which new service categories are emerging? | Early competitive/clinical signal before it's obvious | First appearance of a new HCPCS/service category with rising volume | Sustained volume in the new category over ≥2 periods | — |

## 3. Reimbursement (Q026–Q035)

**Dimensions:** Population — Medicare FFS providers/facilities subject to CMS payment rules. Geography — national / state / specialty. Time horizon — CMS rule cycle (proposed → comment → final → effective), forward-looking by design. Required data — fee schedule rates, payment methodology text, proposed/final rule content and dates. Likely source — Medicare Physician Fee Schedule, IPPS/OPPS final rules, Federal Register, regulations.gov.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q026 | Which CMS payment methodologies are changing? | Root-cause input to nearly every downstream reimbursement question | Proposed rule publication | Final rule publication / effective date | Proposed ≠ final — never represent one as the other (master orchestrator rule) |
| Q027 | Which specialties are exposed? | Targeting for proactive communication/planning | Specialty mentioned in a proposed rule's impact analysis | Realized payment change hitting that specialty's claims | — |
| Q028 | Which procedures are exposed? | Procedure-level planning input | Procedure code listed in rule impact tables | Realized rate change for that code | — |
| Q029 | Which facilities are exposed? | Facility-level planning input (e.g., rural, safety-net) | Facility type flagged in rule impact analysis | Realized payment change by facility type | — |
| Q030 | Where is external payment pressure highest? | Prioritization across specialties/facilities/geographies at once | Composite of Q027–Q029 signals | Realized aggregate payment change | Composite signals need explicit weighting logic, documented when built |
| Q031 | Where does internal/demo reimbursement diverge from CMS benchmarks? | Portfolio-demo-only comparison — illustrates the analytical method, not a real client's book | Early divergence in synthetic/demo data vs. CMS benchmark | Confirmed sustained divergence | Uses labeled synthetic data only — never real employer/client figures (CLAUDE.md guardrail) |
| Q032 | Which provider economics appear to be changing? | Ties rate changes to a plausible economic outcome | Rate change + utilization trend combined | Confirmed margin-relevant shift (proxy only — true provider margins aren't public) | Provider-level financials are not public; this is directional, not a real P&L read |
| Q033 | Which policy changes may alter behavior? | Anticipates provider/beneficiary behavioral response before it shows in claims | Proposed rule's stated behavioral intent | Observed behavior change in claims data | Behavioral response lags policy effective dates, often by multiple quarters |
| Q034 | Which payment changes are leading indicators? | Distinguishes rules that predict future claims shifts from ones that don't | Rule publication itself | Corresponding claims shift, if/when it appears | Never assert a claims effect before it's observed — policy is forward-looking, not retroactively assumed |
| Q035 | Which payment changes should affect claims later? | Sets up what the Claims/Utilization agent should watch for in future periods | Final rule + effective date | Realized claims shift after effective date | This question is explicitly about forward monitoring, not present-tense findings |

## 4. Provider & network (Q036–Q045)

**Dimensions:** Population — Medicare-enrolled providers and facilities. Geography — county / state / CBSA. Time horizon — rolling 12–36 months for concentration trend work. Required data — provider enrollment, ownership, entries/exits, facility counts. Likely source — CMS Provider Enrollment public files, Provider ownership dataset, Hospital General Information, ASC datasets.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q036 | Which providers are growing? | Network strategy / partnership prioritization | New locations, new enrollments under same TIN/ownership | Confirmed multi-period growth in enrolled providers/claims volume | — |
| Q037 | Which providers are contracting? | Early signal of network risk or an opportunity to engage | Facility/enrollment closures | Confirmed multi-period decline | — |
| Q038 | Where is provider concentration increasing? | Market power shift — affects negotiation leverage | Ownership-change filings clustering in a geography | Confirmed concentration-ratio increase | See Metric Dictionary "concentration" |
| Q039 | Where is independent practice consolidating? | Distinct pattern from general concentration — affects contracting strategy specifically | Ownership-change filings showing independent → system transitions | Confirmed sustained consolidation trend | Public ownership data identifies *that* ownership changed more reliably than *why* |
| Q040 | Where are ASCs expanding? | Site-of-care shift with direct network implications | New ASC enrollments | Confirmed ASC volume/count growth | — |
| Q041 | Which ownership changes matter? | Filters routine administrative changes from strategically material ones | Ownership filing itself | Confirmed operational/volume impact following the change | "Matters" requires an explicit materiality threshold — defined in `TREND_FRAMEWORK.md` |
| Q042 | Which provider entries matter? | Same filtering logic applied to market entry | New enrollment filing | Confirmed sustained operation (not a one-time filing) | — |
| Q043 | Which provider exits matter? | Same filtering logic applied to market exit | Enrollment termination / facility closure filing | Confirmed the exit held (not a data artifact) | Public enrollment data can lag actual closures |
| Q044 | Where is capacity declining? | Access-risk signal for leadership | Facility/provider count decline | Confirmed utilization impact from reduced capacity | — |
| Q045 | Where is capacity growing faster than demand? | Oversupply signal — different response than undersupply | Provider growth rate exceeding population/utilization growth rate | Confirmed sustained divergence | Same divergence method as Q007, applied at the provider-capacity level specifically |

## 5. Medicare Advantage & Part D (Q046–Q055)

**Dimensions:** Population — MA and Part D enrollees, at the public plan/county level (not member-level). Geography — county / state / plan service area. Time horizon — monthly enrollment; annual bid, Star Rating, and benefit cycle. Required data — MA/Part D enrollment by plan and county, penetration rate, Star Ratings, benefit design. Likely source — CMS MA/Part D enrollment public files, Star Ratings public data, Plan Benefit Package (PBP) public files.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q046 | Where is MA enrollment changing? | Core market-share input for the MA business | Monthly plan-level enrollment deltas | Confirmed quarterly/annual trend | — |
| Q047 | Where is MA penetration changing? | Distinguishes MA growth from overall Medicare-eligible population growth | Penetration-rate delta (MA enrollees / Medicare-eligible) | Confirmed sustained penetration trend | See Metric Dictionary "penetration" |
| Q048 | Which counties are unusual? | Flags outlier markets worth a closer look | Statistical outlier vs. peer-county baseline | Confirmed the anomaly persisted | Needs a defined peer-comparison method — see `TREND_FRAMEWORK.md` |
| Q049 | Which plan structures are changing? | Competitive/benefit-design intelligence | New PBP filings | Confirmed enrollment response to structure change | — |
| Q050 | What benefit changes matter? | Filters routine annual benefit filing noise from strategically material changes | PBP filing delta | Confirmed enrollment/behavior impact | Materiality threshold, same pattern as Q041 |
| Q051 | What risk adjustment changes matter? | Direct financial-methodology relevance to MA economics | CMS risk-model rule change publication | Realized effect on plan bids/payments (proxy, aggregate only) | Plan-level risk-adjustment financial detail beyond public aggregates is not public |
| Q052 | What Star Rating changes matter? | Star Ratings drive both bonus payments and enrollment/marketing | Star Ratings release (annual) | Enrollment response following the release | — |
| Q053 | What Part D changes matter? | Distinct payment/benefit mechanics from MA medical benefit | Part D benefit parameter filings | Confirmed enrollment/utilization response | — |
| Q054 | What CMS policy changes alter MA economics? | Forward-looking input, same pattern as Q033–Q035 but MA-specific | Proposed MA-specific rule | Realized economic effect (proxy) | — |
| Q055 | Where do external MA trends diverge from the portfolio's demo/internal data? | Same portfolio-demo caveat as Q031, applied to MA | Early divergence in synthetic data vs. public MA benchmark | Confirmed sustained divergence | Synthetic/demo data only — never a real client's MA book |

## 6. Medicaid, CHIP & dual eligibles (Q056–Q065)

**Dimensions:** Population — Medicaid, CHIP, and dual-eligible beneficiaries. Geography — state (Medicaid is state-administered; county-level public data is often unavailable). Time horizon — annual/quarterly, driven by state policy cycles. Required data — enrollment, churn, managed care penetration, state policy changes. Likely source — T-MSIS public releases, Medicaid.gov state-level data, CMS Medicaid managed care enrollment reports.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q056 | Where is Medicaid enrollment changing? | State-level market-share and demand signal | Early state-reported enrollment figures | T-MSIS confirmed enrollment | State reporting lag and consistency vary significantly by state — always label vintage per state |
| Q057 | Where is churn changing? | Retention/continuity-of-coverage signal | Early disenrollment reporting | Confirmed churn-rate trend | Public churn measurement is coarser than a real eligibility system's |
| Q058 | Which states have meaningful policy changes? | Filters 50-state noise to what's actually material | State policy announcement / waiver filing | Confirmed enrollment/access impact | Materiality threshold, same pattern as Q041/Q050 |
| Q059 | Where are Medicaid provider networks changing? | Applies the Provider & Network category's logic to the Medicaid-specific network | Medicaid managed care provider directory changes | Confirmed network composition shift | Provider directory data quality varies by state and plan |
| Q060 | Where is dual eligibility changing? | Distinct population from Medicaid-only — different program interactions (MA D-SNP relevance) | Early dual-eligible enrollment counts | Confirmed sustained trend | — |
| Q061 | Where could Medicaid changes affect other products? | Cross-program spillover — ties this category back to MA (D-SNP) and Marketplace | A Medicaid policy/enrollment signal with a plausible cross-program mechanism | Confirmed movement in the affected adjacent product | Requires explicit, stated mechanism — never imply causality without one (master orchestrator rule) |
| Q062 | Where is behavioral health changing? | Directly relevant given Adam's Eleos Health context (behavioral health tech) — portfolio-honest connection, not fabricated | Early behavioral health service-category utilization | Confirmed sustained trend | Public Medicaid behavioral health detail is thinner than physical health claims detail |
| Q063 | Where are long-term services trends changing? | High-cost, high-strategic-relevance Medicaid category | Early LTSS utilization signal | Confirmed sustained trend | — |
| Q064 | What managed care changes matter? | Managed Medicaid is the dominant delivery model in most states — structural changes matter | MCO contract award/change announcement | Confirmed enrollment shift following the change | — |
| Q065 | Which state-level signals deserve monitoring? | Sets up ongoing watch-list entries, not a one-time answer | Any Q056–Q064 signal crossing a materiality threshold | Sustained presence on the watch-list over ≥2 review cycles | This question is explicitly about building `TREND_FRAMEWORK.md`'s watch-list mechanism, not a single finding |

## 7. Commercial / Marketplace (Q066–Q072)

**Dimensions:** Population — ACA Marketplace (individual/small-group) enrollees. Geography — state / rating area. Time horizon — annual open enrollment cycle. Required data — plan enrollment, premiums, benefit design, service area, issuer participation. Likely source — CMS Marketplace Public Use Files (PUFs).

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q066 | Where is Marketplace enrollment changing? | Core market-share input for the exchange-facing business | Open-enrollment-period sign-up data | Full-year confirmed PUF enrollment | — |
| Q067 | Where are premiums changing? | Pricing/competitive positioning input | Issuer rate filings | Confirmed effective premiums (PUF) | — |
| Q068 | Where are benefits changing? | Benefit-design competitive intelligence | Plan filing benefit-design deltas | Confirmed enrollment response | — |
| Q069 | Where are deductibles changing? | Distinct affordability signal from headline premium | Plan filing deductible deltas | Confirmed enrollment response | — |
| Q070 | Where are service areas changing? | Expansion/contraction signal for issuer strategy | New/withdrawn service-area filings | Confirmed enrollment in changed areas | — |
| Q071 | Where is plan availability changing? | County-level competitive-intensity signal (number of issuers/plans) | Issuer participation filings | Confirmed plan-count trend | — |
| Q072 | What plan changes suggest broader market movement? | Synthesizes Q067–Q071 into a single "what's really happening" read | Composite of premium/benefit/service-area signals | Confirmed multi-signal alignment | Explicitly this category's synthesis question — mirrors Q008's role in Market & Growth |

## 8. Policy, regulation & CMS programs (Q073–Q084)

**Dimensions:** Population — N/A (policy-level, cross-population). Geography — national (state-specific for Medicaid waivers). Time horizon — rule cycle: proposed → comment period → final → effective date. Required data — rule text, comment periods, effective dates, program status. Likely source — Federal Register, CMS.gov newsroom, regulations.gov, CMMI model pages.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q073 | What did CMS announce recently? | Baseline situational awareness — feeds every other policy question | Press release / newsroom post | N/A — this is itself the leading signal | — |
| Q074 | What did CMS finalize recently? | Distinguishes "announced" from "actually binding" | Final rule publication | Effective-date confirmation | Proposed ≠ final (repeated deliberately — this is the master orchestrator's single most emphasized analytical rule) |
| Q075 | What is proposed but not final? | Prevents premature planning against a rule that could still change | Proposed rule publication | Comment period close / final rule (may differ from proposal) | Must always be labeled "proposed," never presented as decided |
| Q076 | What becomes effective next? | Forward operational-readiness calendar | Final rule's stated effective date | Confirmed effective-date arrival | — |
| Q077 | Which policy changes affect payment? | Routes signal to the Reimbursement category | Rule's payment-impact section | Realized rate change | — |
| Q078 | Which affect providers? | Routes signal to the Provider & Network category | Rule's provider-impact section | Realized provider-behavior change | — |
| Q079 | Which affect beneficiaries? | Routes signal to enrollment/access questions across MA, Medicaid, Marketplace | Rule's beneficiary-impact section | Realized enrollment/access change | — |
| Q080 | Which affect utilization? | Routes signal to the Claims & Utilization category | Rule's coverage/coding changes | Realized utilization shift | — |
| Q081 | Which CMS program is expanding? | Growth-opportunity signal (e.g., a CMMI model adding sites) | Program announcement of expansion | Confirmed participant/site count growth | — |
| Q082 | Which CMS program is ending? | Wind-down risk signal | Program sunset announcement | Confirmed program termination | — |
| Q083 | Which new program should be monitored? | Adds a program to the ongoing watch-list, same mechanism as Q065 | New program announcement | Sustained relevance over ≥2 review cycles | — |
| Q084 | Which policy has not yet appeared in claims but could soon? | The explicit bridge question between Policy and Claims/Utilization categories | Final rule + effective date, no claims signal yet | First observed claims-level response | Must never represent this as an observed effect before it's actually observed (master orchestrator rule) |

## 9. Emerging trends & signal detection (Q085–Q095)

**Dimensions:** Population — varies, cross-cutting across all other categories. Geography — varies. Time horizon — short window (recent 1–4 quarters) compared against a longer rolling baseline. Required data — cross-dataset comparison output, not a single raw dataset. Likely source — outputs of the other domain agents, synthesized by the Trend/Emerging Signals agent; this category's "source" is the intelligence layer itself, which is flagged explicitly since it's structurally different from every other category here.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q085 | What is accelerating unexpectedly? | Surfaces signals nobody specifically asked for yet | Rate-of-change outlier vs. expected trajectory | Confirmed sustained acceleration | Requires an "expected trajectory" baseline — see `TREND_FRAMEWORK.md` |
| Q086 | What is decelerating unexpectedly? | Same, for deceleration | Rate-of-change outlier (negative direction) | Confirmed sustained deceleration | — |
| Q087 | What changed direction? | Flags a reversal, which is often more decision-relevant than a continuing trend | Sign change in a rolling trend measure | Confirmed the reversal held over ≥2 periods | — |
| Q088 | What is growing in multiple independent datasets? | Highest-confidence emerging signal — corroborated across sources | Concordant early signal in ≥2 datasets | Concordant confirmed signal in ≥2 datasets | Requires the cross-source corroboration method defined in `TREND_FRAMEWORK.md` |
| Q089 | What is growing in one dataset but not another? | Flags a possible data-definition mismatch OR a genuinely narrow trend — both worth knowing | Divergent signal across datasets | Resolution: either a definitional explanation or a confirmed narrow trend | Never combine datasets without checking definitions (master orchestrator rule) — this question exists partly to catch violations of that rule |
| Q090 | What new category appeared? | First-occurrence detection (new HCPCS code, new plan type, new program) | First appearance in any monitored dataset | Sustained presence over ≥2 periods | — |
| Q091 | What provider cluster is emerging? | Geographic/ownership clustering that predates a formal "concentration" finding | Early co-located ownership-change or entry pattern | Confirmed cluster via concentration metric | — |
| Q092 | What geographic cluster is emerging? | Same clustering logic, applied by geography rather than ownership | Early multi-market co-movement | Confirmed geographic cluster | — |
| Q093 | What new reimbursement pattern is emerging? | Bridges Policy/Reimbursement categories into the emerging-signal layer | Early divergence from historical rate-setting pattern | Confirmed pattern over ≥2 rule cycles | — |
| Q094 | What site-of-care pattern is emerging? | Extends Q018–Q021 into "is a *new* pattern starting," not just tracking known ones | Early volume shift not matching any known site-of-care pattern | Confirmed sustained new pattern | — |
| Q095 | What question are we not currently asking? | The catalog's own gap-check — deliberately open-ended | A cross-dataset anomaly that doesn't map to any existing Q001–Q112 | A new catalog entry added as a result | This question's "answer" is a catalog maintenance action, not a dashboard insight |

## 10. Pharmacy & Part D economics (Q096–Q101)

**Dimensions:** Population — Medicare Part D enrollees and prescribers. Geography — national / state. Time horizon — annual, plus drug-launch-driven events. Required data — prescriber-level drug claims/spend, drug pricing, negotiation program status. Likely source — Medicare Part D Prescribers PUF, CMS Drug Price Negotiation Program data (IRA), ASP/NADAC public pricing files.

Added beyond the starter question set to explicitly cover "pharmacy," one of the master orchestrator's 18 named topics that the starter set touched only tangentially through Part D (Q053).

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q096 | Which drug categories are driving Part D spend growth? | Pharmacy is a fast-growing cost category — direct budget-planning relevance | Early per-category spend uptick in prescriber PUF | Confirmed YoY category spend growth | Prescriber PUF is the most current public granularity; still lags real-time by roughly a year |
| Q097 | Which drugs are subject to CMS price negotiation, and what's their status? | Direct, material financial-policy signal unique to this decade | Drug added to the negotiation-eligible list | Negotiated price effective date reached | IRA negotiation program is new — public data maturity and history depth are still limited |
| Q098 | Where is biosimilar adoption changing? | Cost-reduction opportunity signal | Early biosimilar utilization share uptick | Confirmed sustained share shift from reference product | — |
| Q099 | Which specialty drug categories are growing fastest? | Specialty drugs are the highest-cost-per-unit category — outsized budget impact per unit of growth | Early specialty-category spend/utilization uptick | Confirmed YoY growth | — |
| Q100 | Where does prescriber concentration exist for high-cost drugs? | Applies the Provider & Network "concentration" lens specifically to pharmacy | Early prescriber-count concentration in a drug category | Confirmed concentration ratio (see Metric Dictionary) | — |
| Q101 | How might 340B-related policy changes affect drug economics? | 340B is a recurring, material CMS policy topic with direct pharmacy-economics impact | 340B-related proposed rule or litigation development | Realized reimbursement/acquisition-cost effect | 340B program data is fragmented across multiple public sources; treat any single-source read as partial |

## 11. Value-based care & alternative payment models (Q102–Q107)

**Dimensions:** Population — ACO-attributed beneficiaries and CMMI model participants. Geography — national / state / ACO service area. Time horizon — CMS performance year (annual). Required data — ACO participation, shared savings/losses, quality scores, risk-arrangement type. Likely source — Shared Savings Program (MSSP) public reporting files, CMMI model participant and performance data.

Added beyond the starter question set to explicitly cover "value-based care," the master orchestrator's other named topic without a dedicated category in the starter set — and directly aligned with the Phase 4 data-source list's explicit call-out of "Shared Savings Program" and "ACO datasets."

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q102 | Where is ACO/MSSP participation changing? | Core adoption signal for the value-based-care shift | New ACO applications/agreements | Confirmed participant-count trend | — |
| Q103 | Which ACOs are generating shared savings vs. losses? | Direct performance signal on whether VBC is working where it's tried | Interim quality/utilization signals | Annual MSSP public performance results | MSSP results publish annually with a lag — this is inherently a lagging-indicator-heavy question |
| Q104 | Where is risk-based contract penetration (two-sided risk) increasing? | Distinguishes upside-only from real risk-bearing arrangements — different strategic implication | ACO track-selection filings (one-sided vs. two-sided) | Confirmed multi-year track progression | — |
| Q105 | Which quality measures are improving or declining under VBC models? | Ties financial VBC signals to the quality story leadership also needs | Interim quality reporting | Annual confirmed quality scores | — |
| Q106 | Which CMMI models are expanding, and where? | VBC-specific application of the Policy category's Q081 | CMMI model announcement | Confirmed site/participant expansion | — |
| Q107 | Where does provider consolidation intersect with VBC participation? | Cross-category synthesis — ties Provider & Network concentration findings to VBC strategy | Concurrent Q038 (concentration) + Q102 (ACO participation) signals in the same geography | Confirmed correlation over ≥2 periods | Correlation only — must not be asserted as causal without a stated mechanism |

## 12. Executive strategy (Q108–Q112)

**Dimensions:** Population — N/A (meta-level, cross-program). Geography — N/A. Time horizon — point-in-time, evaluated on each dashboard refresh cycle. Required data — synthesis across all other agents' outputs plus the prior refresh's dashboard state. Likely source — the Executive Orchestrator's own synthesis, not a primary dataset — flagged explicitly, same as the Emerging Trends category's source note.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q108 | What materially changed since the last review? | The Executive Pulse dashboard layer's single most important question | Any signal crossing a defined materiality threshold since last refresh | N/A — this question is itself the review mechanism | Requires a stored "last reviewed state" to diff against — a product/implementation requirement for Phase 5 |
| Q109 | What should leadership investigate? | Converts signals into a prioritized action list, not just a data dump | Signals with high confidence + high business relevance | Confirmation that an investigation happened (out of this system's scope to track) | — |
| Q110 | What should leadership stop assuming? | The system's explicit job of challenging stale assumptions, not just reporting new ones | A signal that contradicts a previously stated assumption on record | Confirmed the assumption was formally revised | Requires assumptions to be recorded somewhere the system can check against — a Phase 5 design requirement |
| Q111 | What external signal could invalidate an existing assumption? | Forward-looking risk-scanning, distinct from Q110's backward-looking check | Any new Policy/Emerging-Trends signal touching a recorded assumption | Confirmed the invalidation occurred | Same dependency on a recorded-assumptions store as Q110 |
| Q112 | What leading indicator should be added to the dashboard? | The catalog's own continuous-improvement question — mirrors Q095 for the metric/indicator layer specifically | A recurring finding not currently backed by a dashboard-tracked leading indicator | A new indicator added to `METRIC_DICTIONARY.md`/`TREND_FRAMEWORK.md` as a result | This question's "answer" is a dictionary/framework maintenance action, not a standalone insight |

## 13. Market/Catalyst Intelligence (Q113–Q124, Q129)

Added 2026-09-24, beyond the original 112-question starter set — a new
category built around real corporate-disclosure, drug-approval,
federal-grant, and clinical-trial-results activity, owned outright by the
12th agent (`market-catalyst-intelligence`, no joint ownership). Unlike
every other category above, this one is not CMS-program data at all —
its sources are SEC EDGAR, openFDA, NIH RePORTER, and ClinicalTrials.gov.
Q129 (NIH research-theme frequency) added the same day, per Adam's
feedback request - a one-question extension of this same category, see
Q129's own row above.

**Dimensions:** Population — N/A (corporate/regulatory/research-grant
activity, not a beneficiary population). Geography — national. Time
horizon — rolling 730-day (2-year) window, widened 2026-09-24 from an
original 150 days per Adam's request for deeper real historical coverage
(wider than this dashboard's CMS-program sources, since these sources
publish less predictably and their own live APIs support real historical
date-range queries CMS's own datastore API does not - see
SOURCE_REGISTRY.md). Required data — 8-K filings for a fixed 6-company
health-insurer watchlist, novel-drug approval records, NIH award notices,
and industry-sponsored Phase 3 results postings. Likely source — SEC
EDGAR submissions API, openFDA drugsfda, NIH RePORTER projects/search,
ClinicalTrials.gov v2 studies API.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q113 | What is the largest real NIH award notice, and how many were issued this window? | Direct catalyst signal for where NIH-funded research capacity is concentrating | A real high-dollar award notice | Sustained award activity in a related organization/category | Sampled top-100-by-dollar out of the real total population for the window |
| Q114 | What is the total real NIH award-dollar volume sampled this window? | A distinct aggregate-scale KPI from Q113's single-largest-award figure | Real sampled award-dollar total | Confirmed multi-period volume trend | Understates true total obligations — covers only the sampled top-100 awards |
| Q115 | How do sampled NIH award dollars split by funding agency? | A market-level concentration read on which HHS operating division's dollars dominate the sample | Real per-agency dollar share | Confirmed multi-period share shift | The real `agency_code` field is the sponsoring agency (e.g. NIH/FDA/CDC-adjacent), not NIH institute/center-level detail — see this category's agent header for the live-verified correction |
| Q116 | Which real organizations are receiving the most sampled NIH award dollars? | A real, sourced funding-concentration ranking naming real universities/health systems | Real per-organization dollar total | Confirmed multi-period ranking shift | Sampled top-100-by-dollar only — an organization with many small awards is undercounted |
| Q117 | How many real new molecular entity (Type 1) drug approvals occurred this window, and what's the most recent? | A regulatory-approval catalyst marking a new product's real market entry | A real Type 1 approval | Confirmed post-launch utilization signal (not tracked by this agent) | openFDA's search matches at the application level — this source re-filters to the real matching submission(s) only |
| Q118 | What share of new molecular entity approvals this window received PRIORITY vs. STANDARD review? | Real FDA-stated significance signal, distinct from an efficacy claim | Real per-approval review-priority field | Confirmed multi-period share shift | Never uses "breakthrough therapy" — that field does not exist in this dataset |
| Q119 | How are new molecular entity approvals distributed by month this window? | A real approval-cadence read, same shape as this dashboard's CMS-rules-per-month chart | Real monthly approval count | Confirmed multi-period cadence pattern | Small real monthly counts — month-to-month variation is not yet statistically meaningful |
| Q120 | Which tracked health insurers filed an Item 5.02 8-K this window, and which filed none? | A real, disclosed leadership-change signal (departure OR appointment) at a tracked competitor | A real Item 5.02 filing | Confirmed leadership continuity or further change | Item 5.02 covers both departure and appointment — never characterized as "fired" or "resigned" |
| Q121 | What is the real 8-K item-code mix across the whole tracked watchlist? | An industry-wide "what kind of activity is happening" read, distinct from the per-company breakdowns | Real item-code occurrence share | Confirmed multi-period mix shift | A single filing can carry multiple item codes — occurrences, not filing counts |
| Q122 | Which tracked health insurers filed an Item 1.01 8-K this window? | A real, disclosed material-agreement signal at a tracked competitor | A real Item 1.01 filing | Confirmed the agreement's real operational impact (not tracked by this agent) | Item 1.01 covers far more than partnerships (credit facilities, leases, etc.) — never characterized as "a partnership" |
| Q123 | How many industry-sponsored Phase 3 trials had results newly posted this window, and what's the most recent? | A concrete, dated clinical/formulary-planning catalyst | A real results posting | Confirmed downstream regulatory/market action (not tracked by this agent) | A results posting encodes no success/failure judgment — never says "positive result" |
| Q124 | What is the enrollment-size distribution across those newly reported trials? | A real proxy for a trial's evidentiary weight and real-world relevance | Real per-trial enrollment count | Confirmed the enrollment scale mattered to a downstream decision (not tracked by this agent) | Only built when at least 20 real trials are in the sample — otherwise honestly skipped, not fabricated |
| Q129 | What research themes and topics is sampled NIH funding actually concentrating in? | Shows *what* the funded research is about, not just who/how much — added 2026-09-24 per Adam's request | A real keyword term crossing the frequency-band threshold | Confirmed the same theme leads across a second real pull | NIH's real `terms` field generates many near-synonymous phrasings for one concept — not merged, see this agent's own insight limitations |

---

## 14. Hospital star rating vs. quality outcomes (Q125–Q128)

Added 2026-09-24 per Adam's PDF-annotated feedback requesting a
star-rating-vs-quality-outcomes read - a thematic extension of Provider &
Network's existing Q036-045 scope onto the same real, already-live
Hospital General Information dataset, not a new data source. Owned by
`provider-network-intelligence` (no joint ownership).

**Dimensions:** Population — Medicare-enrolled hospitals reporting a real
CMS overall star rating. Geography — national (Q125) / state (Q126-128).
Time horizon — CMS's own quarterly refresh cadence for this dataset (not
this dashboard's own pull frequency). Required data — real
`hospital_overall_rating` plus real mortality/safety/readmission
measure-group better/worse/no-different counts. Likely source — CMS
Hospital General Information (already live, see AGENT_ARCHITECTURE.md §5
and Q001/Q038's existing use of this same dataset).

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q125 | Does a hospital's overall star rating actually track its real mortality/safety/readmission outcome performance? | Tests whether star rating alone is a sufficient quality proxy, or whether the underlying measure detail needs direct review | A real per-hospital net quality-outcome score | Confirmed the correlation's strength holds across a second real snapshot | Correlation, not causation - the star rating is partly derived from these same measure groups, so some correlation is expected by construction |
| Q126 | How does the real hospital overall star rating distribution vary by state? | A state-level quality-by-geography read for network-quality prioritization | Real per-state star-rating quartiles | Confirmed multi-period distributional shift | Limited to states with >=20 hospitals reporting a real, non-suppressed rating |
| Q127 | How does the real net quality-outcome score distribution vary by state? | The outcomes-specific counterpart to Q126 - checks whether a state's star-rating standing and its underlying outcome performance tell the same story | Real per-state net-quality-outcome-score quartiles | Confirmed multi-period distributional shift | Covers only the mortality/safety/readmission measure groups this dataset reports a better/worse/no-different count for |
| Q128 | Which states show a real, persistent improvement in hospital quality outcomes over time, and which have the best current outcomes? | Directly answers leadership's "which states are getting better" question, honestly, without forcing a trend claim before one is real | A real state median net-quality-outcome score moving in the same direction across 2 consecutive real pulls | Confirmed sustained multi-quarter improvement | This CMS dataset refreshes quarterly - a "no persistent improvement yet" finding this early in this dashboard's own pull history reflects that real refresh cadence, not a system limitation |

---

## Coverage check against the master orchestrator's required topics

Market growth (§1) · enrollment (§1, §5, §6, §7) · claims (§2) · utilization (§2) · cost (§2, §3) · reimbursement (§3) · provider/network (§4, §14) · site of care (§2 Q018–Q021, §9 Q094) · Medicare Advantage (§5) · Part D (§5, §10) · Medicaid (§6) · dual eligibles (§6 Q060) · Marketplace (§7) · pharmacy (§10) · value-based care (§11) · policy (§8) · CMS programs (§8) · emerging trends (§9). All 18 named topics are represented by at least one dedicated question.

---

## 15. Market Catalysts: health-industry 8-Ks and Form D (Q160–Q165)

Added 2026-09-25, owned by `market-catalyst-intelligence` and shown in the
Market Catalysts layer. Numbered from Q160 so three sessions adding sources
in parallel that day could each take a separate block. Two SEC sources: 8-K
filings by every company in 24 health-industry SIC codes (widening the
6-insurer watchlist behind Q120–Q122, which keeps running), and SEC's
quarterly Form D data sets filtered to health-care issuers. See
SOURCE_REGISTRY.md.

**Dimensions:** Population — N/A (corporate filings). Geography — national;
issuer state for Q165. Time horizon — trailing 730 days for the 8-Ks; the
latest 8 quarterly Form D files (two full years) for Q163–Q165.

| # | Question | Why leadership needs it / decision supported | Leading indicator | Lagging indicator | Notable limitation |
|---|---|---|---|---|---|
| Q160 | Which health-industry companies completed an acquisition or disposition of assets (8-K Item 2.01), and in which sectors? | Consolidation and divestitures among drug makers, device makers, distributors, insurers and providers change who a plan contracts with and what it pays | A new Item 2.01 filing | Sector mix of completed deals across pulls | Item 2.01 covers disposals as well as acquisitions; deal size and counterparty are in the filing text, not read |
| Q161 | Which health-industry companies filed the most material definitive agreements (Item 1.01)? | Licensing, supply, financing and merger agreements often come before a launch, a financing or an acquisition | A cluster of Item 1.01 filings at one company | Confirmed deal activity in later filings | Item 1.01 covers far more than partnerships; frequent small financings dominate the top counts |
| Q162 | Which health-industry companies filed the most director or officer changes (Item 5.02)? | Leadership changes at competitors and suppliers often come before shifts in strategy | A cluster of Item 5.02 filings | Confirmed strategy change | Covers appointments as well as departures; never read as a firing or resignation, and never tied to enrollment or performance |
| Q163 | How much private capital did health-care companies report raising on Form D, by industry group and quarter? | The funding behind the next wave of drugs, devices and care-delivery competitors | A quarter's amount sold against the same quarter a year earlier | A sustained multi-quarter shift | Form D covers listed-company private placements and debt as well as venture rounds; amendments folded into their original offering, never double counted |
| Q164 | Which health-care companies reported the largest private offerings? | Names well-funded entrants and expanding competitors from their own SEC notices | A new large notice | Amendments raising the amount sold | Amounts are as the issuer reported them; naming reports the filing, not an assessment of the company |
| Q165 | Where are health-care private offering dollars concentrated by issuer state? | Shows the clusters most likely to produce new competitors and partners | A state's share of amount sold | Share held across later quarters | Located by the primary issuer's principal place of business, not where the money is spent |
