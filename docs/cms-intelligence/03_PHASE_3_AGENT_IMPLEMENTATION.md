# PHASE 3 — AGENT TEAM IMPLEMENTATION

## Claude Code task

Implement the healthcare intelligence agent layer.

The goal is a maintainable multi-agent architecture, not twelve independent chatbots.

## Architecture principle

Use a central orchestrator with specialized domain agents.

Conceptually:

```text
                    Executive Orchestrator
                             |
        ------------------------------------------------
        |        |        |        |        |          |
      Market   Claims   Payment  Provider   Policy   Trends
        |        |        |        |        |          |
        ------------------------------------------------
                             |
                     Evidence / Signals
                             |
                      Executive Insight
```

## Agent responsibilities

### 1. Executive Intelligence Orchestrator

Responsibilities:

- receive an executive question
- identify relevant specialists
- request evidence
- reconcile conflicting evidence
- synthesize findings
- generate executive insight
- preserve citations/provenance
- identify missing evidence

Never perform all domain analysis itself when a specialist is appropriate.

### 2. Market Growth & Geographic Intelligence

Focus on:

- enrollment
- population
- utilization
- spend
- provider supply
- geographic concentration
- market growth
- service-line expansion
- market composition

### 3. Claims, Utilization & Cost

Focus on:

- utilization
- spend
- frequency
- cost per episode
- cost per unit
- trend
- site of care
- intensity
- mix
- utilization/cost decomposition

### 4. Reimbursement & Payment

Focus on:

- CMS payment methodologies
- physician fee schedule
- inpatient
- outpatient
- ASC
- post-acute payment
- MA payment
- Part D
- external reimbursement benchmarks

### 5. Provider & Network

Focus on:

- provider growth
- exits
- enrollment
- ownership
- consolidation
- concentration
- capacity
- specialty expansion

### 6. MA & Part D

Focus on:

- enrollment
- penetration
- plan structure
- county trends
- benefits
- risk adjustment
- Star Ratings
- Part D
- payment policy

### 7. Medicaid, CHIP & Duals

Focus on:

- enrollment
- churn
- managed care
- provider environment
- dual eligibility
- state policy
- utilization

### 8. Marketplace

Focus on:

- enrollment
- plan availability
- premiums
- benefits
- cost sharing
- service area
- plan changes

### 9. Policy & CMS Programs

Focus on:

- proposed rules
- final rules
- payment changes
- CMS Innovation Center
- ACOs
- program changes
- implementation timing

### 10. Emerging Trends

Focus on signals nobody explicitly requested.

It may create new questions.

### 11. Data Source Monitor

Focus on:

- dataset updates
- schema changes
- new files
- retired files
- methodology changes
- publication changes
- new CMS programs

### 12. Data Architecture / Semantic Model

Focus on:

- canonical dimensions
- definitions
- joins
- lineage
- source metadata
- semantic consistency

## Agent implementation standard

Every agent definition must include:

- mission
- scope
- questions
- inputs
- tools
- source constraints
- analytical methods
- output schema
- confidence requirements
- escalation conditions
- failure behavior
- provenance requirements

## Deterministic vs LLM work

Use deterministic code for calculations.

Use LLMs for:

- research synthesis
- policy interpretation
- narrative synthesis
- semantic classification
- question generation
- cross-source reasoning

Never let an LLM silently calculate business-critical numbers when deterministic code can calculate them.

## Tool abstraction

Create interfaces such as:

- `data_source`
- `source_registry`
- `analytics`
- `trend_engine`
- `evidence_store`
- `model_provider`

Keep provider-specific code isolated.

## Human-in-the-loop

Provide a path for a reviewer to inspect:

- source
- calculation
- reasoning summary
- confidence
- unresolved ambiguity

Do not expose hidden chain-of-thought.

Expose concise, auditable evidence summaries instead.

## Required outputs

Create a modular agent directory appropriate to the repository, ideally equivalent to:

```text
.claude/
  agents/
    executive-orchestrator.md
    market-intelligence.md
    claims-utilization.md
    reimbursement.md
    provider-network.md
    medicare-advantage.md
    medicaid-duals.md
    marketplace.md
    cms-policy.md
    emerging-trends.md
    source-monitor.md
    data-architecture.md
```

Also create:

- agent interface/types
- orchestration contract
- provider interface
- structured-output validation
- unit tests for schemas

## Acceptance criteria

A test query should be able to invoke at least two specialist agents and produce a synthesized insight with explicit evidence references.
