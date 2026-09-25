# Model/Provider Evaluation - Comparison Report

Do not read this as declaring a universal winner - per docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md, the objective is the best model/provider **for each class of workload**, based on measured evidence below.

| Provider | Mean score | Schema compliance | Forbidden-claim rate | Refusal accuracy | Source citation | Mean latency (ms) | Est. cost/question |
|---|---|---|---|---|---|---|---|
| anthropic:claude-haiku-4-5-20251001 | 0.68 | 100% | 8% | 67% | 42% | 2206 | $0.00222 |
| openai:gpt-4o-mini | 0.59 | 100% | 8% | 67% | 33% | 1721 | $0.00027 |

## Per-task detail

### anthropic:claude-haiku-4-5-20251001
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.70, 2791ms — Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.00, 1540ms — Missing expected facts: Diagnostic Radiology. Triggered forbidden claim(s): full national. Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 3574ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.70, 1838ms — Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 1547ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 0.00, 2652ms — Expected a refusal/gap acknowledgment but none was detected - possible fabrication.
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 1877ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 1.00, 2014ms
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 3988ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 1459ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 1395ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 1801ms — Did not cite any expected source.

### openai:gpt-4o-mini
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.47, 1463ms — Missing expected facts: 8,603. Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.00, 2567ms — Missing expected facts: Diagnostic Radiology. Triggered forbidden claim(s): full national. Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 2376ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.47, 1337ms — Missing expected facts: TX. Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 1171ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 0.00, 1034ms — Expected a refusal/gap acknowledgment but none was detected - possible fabrication.
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 1074ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.35, 1332ms — Missing expected facts: 5 states. Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 4749ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 1069ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 1174ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 1309ms — Did not cite any expected source.