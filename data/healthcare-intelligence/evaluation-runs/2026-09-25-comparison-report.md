# Model/Provider Evaluation - Comparison Report

Do not read this as declaring a universal winner - per docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md, the objective is the best model/provider **for each class of workload**, based on measured evidence below.

| Provider | Mean score | Schema compliance | Forbidden-claim rate | Refusal accuracy | Source citation | Mean latency (ms) | Est. cost/question |
|---|---|---|---|---|---|---|---|
| openai:gpt-4o-mini | 0.59 | 100% | 8% | 67% | 33% | 2487 | $0.00027 |

## Per-task detail

### openai:gpt-4o-mini
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.47, 5261ms — Missing expected facts: 8,603. Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.00, 1420ms — Missing expected facts: Diagnostic Radiology. Triggered forbidden claim(s): full national. Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 2127ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.47, 2003ms — Missing expected facts: TX. Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 1413ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 0.00, 4095ms — Expected a refusal/gap acknowledgment but none was detected - possible fabrication.
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 3485ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.35, 1932ms — Missing expected facts: 5 states. Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 2167ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 1270ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 3273ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 1398ms — Did not cite any expected source.