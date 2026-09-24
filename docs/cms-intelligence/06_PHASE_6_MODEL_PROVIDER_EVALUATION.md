# PHASE 6 — MODEL / PROVIDER EVALUATION & COST CONTROL

## Claude Code task

Build a provider-independent model evaluation framework.

The purpose is to determine empirically which model/runtime is appropriate for each workload.

## Critical architecture principle

Do not make the business logic Claude-specific.

Agent prompts, output schemas, analytical methods, source registry, evidence model, and trend logic should remain portable.

Only the model adapter should know which provider is being called.

## Providers to support experimentally

The framework should be able to test, where credentials/access are available:

- Claude / Claude Code during development
- OpenAI API
- additional hosted providers
- local/open-source models
- Cerebras-hosted inference
- other providers added later

Do not hard-code provider-specific assumptions into the intelligence layer.

## Development vs production

Treat these as separate concerns.

### Development environment

Claude Code may be the primary development interface.

Use it to:

- build
- inspect
- refactor
- test
- research
- generate agent definitions

### Runtime environment

The production dashboard should call a configurable model provider through an adapter.

Do not assume the Claude subscription used for development is the final production architecture.

## Evaluation dimensions

Evaluate each model on:

### Quality

- factual accuracy
- source fidelity
- evidence selection
- citation completeness
- numerical fidelity
- trend identification
- policy interpretation
- executive synthesis

### Reliability

- schema compliance
- malformed output rate
- tool-use failure
- timeout
- retry behavior
- consistency across repeated runs

### Safety / governance

- unsupported assertions
- invented citations
- unsupported causal claims
- stale-source use
- population mismatch
- data confidentiality violations

### Performance

- latency
- throughput
- context requirements
- token consumption

### Economics

Estimate:

- cost per question
- cost per insight
- cost per dashboard refresh
- cost per daily/weekly monitoring run
- cost at projected scale

Do not assume the cheapest model is best.

Do not assume the largest model is best.

## Benchmark suite

Create a fixed evaluation set containing realistic tasks:

1. identify a material utilization trend
2. identify a reimbursement change
3. interpret a CMS policy update
4. compare two geographic markets
5. identify provider concentration
6. explain a site-of-care change
7. summarize MA enrollment change
8. detect an emerging signal
9. reconcile conflicting evidence
10. refuse an unsupported inference
11. preserve source provenance
12. generate an executive insight

Each task should have expected evidence and scoring criteria.

## Golden evaluation records

Store structured expected answers where possible:

```json
{
  "task_id": "cms-trend-001",
  "question": "...",
  "expected_sources": ["source-a"],
  "required_facts": ["fact-a", "fact-b"],
  "forbidden_claims": ["unsupported-causality"],
  "quality_criteria": []
}
```

## Model router concept

Support task-specific model selection.

Example:

```text
Deterministic calculation → code
Simple classification → lower-cost model
Source summarization → efficient model
Complex cross-source synthesis → stronger model
Executive synthesis → strongest practical model
```

Do not route by model prestige.

Route by demonstrated task performance and economics.

## Claude Max / API decision

Do not make the decision from assumption.

Build a small workload model.

Measure:

- number of agent calls
- average context
- expected runs/day
- expected concurrent users
- tool-call frequency
- retry volume
- research workload
- dashboard refresh requirements

Then determine whether subscription-based development is sufficient for development/testing and whether API inference is required for the intended product behavior.

## Required outputs

Create:

- provider adapter interface
- benchmark suite
- evaluation schema
- test fixtures
- results storage
- comparison report
- cost estimation
- recommended routing strategy

Do not declare a provider the universal winner.

The objective is to identify the best model/provider **for each class of workload** based on measured evidence.

## Future local/open-source path

Keep the architecture compatible with:

- local inference
- self-hosted models
- hosted open-source inference
- Cerebras or other specialized inference providers

Do not make future migration a rewrite.

## Acceptance criteria

The same benchmark can be run through at least two providers or two model configurations with the same input and scoring logic.
