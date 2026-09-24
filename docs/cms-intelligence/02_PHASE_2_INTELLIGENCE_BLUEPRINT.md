# PHASE 2 — INTELLIGENCE BLUEPRINT

## Claude Code task

Design the healthcare intelligence system before implementing the full dashboard.

You are simultaneously acting as:

- healthcare strategy analyst
- data architect
- AI systems architect
- executive product strategist

## 1. Executive question catalog

Create at least 100 questions across:

- market growth
- enrollment
- claims
- utilization
- cost
- reimbursement
- provider/network
- site of care
- Medicare Advantage
- Part D
- Medicaid
- dual eligibles
- Marketplace
- pharmacy
- value-based care
- policy
- CMS programs
- emerging trends

For every question document:

- question
- why leadership needs it
- decision supported
- population
- geography
- time horizon
- required data
- likely source
- limitations
- leading indicator
- lagging indicator

Do not build the catalog as a list of metrics. Build it as a list of executive questions.

## 2. Agent map

Define responsibilities, inputs, outputs, dependencies, and escalation rules for:

1. Executive Orchestrator
2. Market Intelligence
3. Claims / Utilization / Cost
4. Reimbursement
5. Provider / Network
6. MA / Part D
7. Medicaid / Duals
8. Marketplace
9. Policy / CMS Programs
10. Emerging Trends
11. Data Source Monitor
12. Data Architecture

## 3. Evidence model

Design a canonical insight object.

Example:

```json
{
  "id": "signal-id",
  "headline": "Human-readable signal",
  "question_id": "question-id",
  "signal_type": "trend",
  "period": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  },
  "population": "...",
  "geography": "...",
  "magnitude": {},
  "drivers": [],
  "business_relevance": "...",
  "evidence": [],
  "contradictory_evidence": [],
  "confidence": "high",
  "freshness": {},
  "next_signal": "...",
  "recommended_internal_validation": "...",
  "source_ids": []
}
```

Adapt the schema to the application stack.

## 4. Metric dictionary

Define canonical formulas for:

- enrollment
- utilization per 1,000
- PMPM
- allowed cost
- paid cost
- cost per episode
- cost per unit
- rate
- benchmark
- growth
- acceleration
- penetration
- concentration
- market share
- mix
- site-of-care share

Explicitly define population and denominator for every measure.

## 5. Trend framework

Define:

- baseline windows
- rolling averages
- YoY comparison
- acceleration
- change points
- anomaly thresholds
- minimum sample sizes
- suppression
- seasonality
- persistence
- external corroboration
- confidence

Do not call a movement an emerging trend after one observation unless an external event clearly explains it.

## 6. Dashboard information architecture

Define the seven executive layers:

- Executive Pulse
- Market & Growth
- Claims & Cost
- Reimbursement & Provider Economics
- Provider & Network
- Policy & Program Watch
- Emerging Signals

For each page specify:

- executive questions
- data required
- visual types
- interactions
- drilldowns
- evidence behavior
- alerts

## 7. Data gap register

Create a list of important questions that cannot be answered with public data alone.

For each:

- missing source
- why it matters
- possible internal source
- possible public proxy
- synthetic/demo approach
- data-risk caveat

## Required outputs

Create:

- `docs/healthcare-intelligence/EXECUTIVE_QUESTION_CATALOG.md`
- `docs/healthcare-intelligence/AGENT_ARCHITECTURE.md`
- `docs/healthcare-intelligence/EVIDENCE_MODEL.md`
- `docs/healthcare-intelligence/METRIC_DICTIONARY.md`
- `docs/healthcare-intelligence/TREND_FRAMEWORK.md`
- `docs/healthcare-intelligence/DASHBOARD_BLUEPRINT.md`
- `docs/healthcare-intelligence/DATA_GAP_REGISTER.md`

## Acceptance criteria

No dashboard feature should exist without a clear question it answers.

Every major question should map to one or more possible evidence sources.

Every source should map back to one or more questions.
