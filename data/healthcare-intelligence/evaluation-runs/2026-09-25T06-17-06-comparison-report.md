# Model/Provider Evaluation - Comparison Report

Do not read this as declaring a universal winner - per docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md, the objective is the best model/provider **for each class of workload**, based on measured evidence below.

| Provider | Mean score | Schema compliance | Forbidden-claim rate | Refusal accuracy | Source citation | Mean latency (ms) | Est. cost/question |
|---|---|---|---|---|---|---|---|
| anthropic:claude-haiku-4-5-20251001 | 0.74 | 100% | 0% | 100% | 33% | 2050 | $0.00222 |
| anthropic:claude-sonnet-5 | 0.85 | 100% | 0% | 100% | 50% | 5667 | $0.00444 |
| anthropic:claude-opus-5-5 | 0.92 | 100% | 0% | 100% | 75% | 7035 | $0.00888 |
| openai:gpt-4o-mini | 0.70 | 100% | 0% | 100% | 33% | 2790 | $0.00027 |
| openai:gpt-6-luna | 0.68 | 100% | 0% | 100% | 33% | 2313 | $0.00022 |
| openai:gpt-6-sol | 0.72 | 100% | 0% | 100% | 33% | 3750 | $0.00444 |

## Per-task detail

### anthropic:claude-haiku-4-5-20251001
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.70, 2687ms — Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.35, 1625ms — Missing expected facts: Diagnostic Radiology. Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 3188ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.70, 1265ms — Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 1567ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 2147ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 1587ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.35, 1441ms — Missing expected facts: 5 states. Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 4450ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 1498ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 1415ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 1725ms — Did not cite any expected source.

### anthropic:claude-sonnet-5
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.70, 4187ms — Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.70, 6197ms — Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 11132ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 1.00, 4521ms
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 8415ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 5289ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 3257ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.70, 5740ms — Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 10783ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 3330ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 2020ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 1.00, 3134ms

### anthropic:claude-opus-5-5
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.70, 7872ms — Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 1.00, 5989ms
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 12852ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 1.00, 6642ms
- **cms-eval-005-provider-concentration** (provider-concentration) — score 1.00, 8529ms
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 5828ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 4202ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 1.00, 8077ms
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 12707ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 4959ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 3379ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 1.00, 3386ms

### openai:gpt-4o-mini
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.47, 2311ms — Missing expected facts: 8,603. Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.35, 1479ms — Missing expected facts: Diagnostic Radiology. Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 1696ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.47, 897ms — Missing expected facts: TX. Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 1428ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 1742ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 1081ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.35, 1036ms — Missing expected facts: 5 states. Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 16872ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 1161ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 1410ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 2363ms — Did not cite any expected source.

### openai:gpt-6-luna
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.70, 2061ms — Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.35, 2126ms — Missing expected facts: Diagnostic Radiology. Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 4023ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.47, 2336ms — Missing expected facts: TX. Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.23, 2633ms — Missing expected facts: Voluntary non-profit, Proprietary. Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 1976ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 1601ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.35, 1718ms — Missing expected facts: 5 states. Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 3269ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 1513ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 1810ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 2684ms — Did not cite any expected source.

### openai:gpt-6-sol
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.70, 2681ms — Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.35, 2584ms — Missing expected facts: Diagnostic Radiology. Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 13264ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.47, 3589ms — Missing expected facts: TX. Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 2302ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 2358ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 1945ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.35, 2217ms — Missing expected facts: 5 states. Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 4719ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 2563ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 2968ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 3814ms — Did not cite any expected source.