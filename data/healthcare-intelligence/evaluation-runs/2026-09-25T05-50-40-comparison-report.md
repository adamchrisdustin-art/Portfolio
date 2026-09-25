# Model/Provider Evaluation - Comparison Report

Do not read this as declaring a universal winner - per docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md, the objective is the best model/provider **for each class of workload**, based on measured evidence below.

| Provider | Mean score | Schema compliance | Forbidden-claim rate | Refusal accuracy | Source citation | Mean latency (ms) | Est. cost/question |
|---|---|---|---|---|---|---|---|
| anthropic:claude-sonnet-5 | 0.85 | 100% | 0% | 100% | 50% | 4203 | $0.00444 |
| anthropic:claude-opus-5-5 | 0.78 | 100% | 0% | 100% | 67% | 13969 | $0.00888 |
| openai:gpt-4o-mini | 0.70 | 100% | 0% | 100% | 33% | 1752 | $0.00027 |

## Per-task detail

### anthropic:claude-sonnet-5
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.70, 5278ms — Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.70, 4483ms — Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 5342ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.70, 3332ms — Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 4247ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 4582ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 3164ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 1.00, 4562ms
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 5523ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 4516ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 1935ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 1.00, 3471ms

### anthropic:claude-opus-5-5
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.70, 5120ms — Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 1.00, 4303ms
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.30, 5053ms — Missing expected facts: 13, 8, final, proposed.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 1.00, 119041ms
- **cms-eval-005-provider-concentration** (provider-concentration) — score 1.00, 5788ms
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 4443ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 3299ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.70, 5013ms — Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.00, 4678ms — Missing expected facts: 0.97, 330. Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 4989ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 3098ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 2797ms — Did not cite any expected source.

### openai:gpt-4o-mini
- **cms-eval-001-utilization-trend** (utilization-trend) — score 0.47, 1889ms — Missing expected facts: 8,603. Did not cite any expected source.
- **cms-eval-002-reimbursement-change** (reimbursement-change) — score 0.35, 1737ms — Missing expected facts: Diagnostic Radiology. Did not cite any expected source.
- **cms-eval-003-policy-interpretation** (policy-interpretation) — score 0.70, 3172ms — Did not cite any expected source.
- **cms-eval-004-geographic-comparison** (geographic-comparison) — score 0.47, 1330ms — Missing expected facts: TX. Did not cite any expected source.
- **cms-eval-005-provider-concentration** (provider-concentration) — score 0.70, 1376ms — Did not cite any expected source.
- **cms-eval-006-site-of-care-change** (site-of-care-change) — score 1.00, 1247ms
- **cms-eval-007-ma-enrollment-summary** (ma-enrollment-summary) — score 1.00, 1658ms
- **cms-eval-008-emerging-signal** (emerging-signal-detection) — score 0.35, 1442ms — Missing expected facts: 5 states. Did not cite any expected source.
- **cms-eval-009-evidence-reconciliation** (evidence-reconciliation) — score 0.70, 2748ms — Did not cite any expected source.
- **cms-eval-010-unsupported-inference-refusal** (unsupported-inference-refusal) — score 1.00, 1154ms
- **cms-eval-011-source-provenance** (source-provenance) — score 1.00, 1344ms
- **cms-eval-012-executive-synthesis** (executive-synthesis) — score 0.70, 1931ms — Did not cite any expected source.