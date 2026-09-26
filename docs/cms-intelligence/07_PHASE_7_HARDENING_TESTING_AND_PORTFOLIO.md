# PHASE 7 — HARDENING, TESTING & PORTFOLIO DELIVERY

## Claude Code task

Turn the prototype into a credible portfolio-quality engineering project.

## 1. Test the analytical layer

Test:

- formulas
- denominators
- grouping
- geography mapping
- population filters
- trend calculations
- anomaly calculations
- source freshness
- schema changes
- evidence provenance

## 2. Test the agent layer

Test:

- routing
- structured output
- tool invocation
- evidence requirements
- unsupported inference handling
- conflicting evidence
- missing data
- stale sources
- source failures

## 3. Test the dashboard

Test:

- routes
- loading
- empty
- error
- stale
- responsive
- accessibility
- visual overflow
- interaction paths

## 4. Test source monitoring

Create fixtures for:

- new column
- removed column
- changed datatype
- renamed field
- changed publication date
- revised historical data
- retired dataset

The system should detect and record these.

## 5. Observability

Log useful operational information without exposing sensitive data:

- task ID
- agent
- model provider
- model
- latency
- token/cost metadata when available
- data sources used
- success/failure
- validation result

## 6. Security

Verify:

- no secrets in source control
- environment variables documented
- no real PHI
- no confidential files
- no sensitive API responses persisted accidentally
- demo data clearly marked

## 7. Documentation

Create or update:

- project README
- architecture diagram
- agent architecture
- data-source map
- question catalog summary
- evaluation methodology
- local setup
- environment variables
- demo mode
- known limitations
- future enterprise integration

## 8. Portfolio case study

Write a concise case study covering:

### Challenge

Leadership needs signals, not more reports.

### Solution

An executive healthcare intelligence engine combining specialized agents, public CMS data, deterministic analytics, source monitoring, and evidence-backed synthesis.

### Technical architecture

Show:

```text
CMS / Public Data
       ↓
Source Registry
       ↓
Data / Analytics Layer
       ↓
Specialized Agents
       ↓
Executive Orchestrator
       ↓
Evidence-backed Insights
       ↓
Dashboard
```

### Agent architecture

Show all domain agents.

### Why it matters

Explain:

- faster understanding
- external benchmarking
- early detection
- policy awareness
- evidence traceability
- extensibility to internal enterprise data

### Honest limitations

Explicitly state:

- public-data constraints
- delayed CMS data
- proxy limitations
- synthetic/demo internal data
- model limitations
- no proprietary UHC/Optum access

## 9. Final reviewer test

Pretend you are a senior executive who has never seen the project.

Can you answer within five minutes:

1. What changed?
2. Why does it matter?
3. Where is it happening?
4. Who is affected?
5. What is driving it?
6. What does the evidence say?
7. How fresh is the evidence?
8. What is uncertain?
9. What should I watch next?
10. Why is the agent architecture useful?

If not, improve the product.

**Run 2026-09-25 (fallback state: no reasoned run matched the data, so no
briefing showed).** Result: failed. Pass: Q3 where, Q6 evidence. Partial:
Q2 why (internal references in copy), Q4 who (no stakeholder, mixed MA
denominators), Q7 freshness ("data as of" mixed pull and data dates), Q8
uncertain (almost all findings low; false "about a week" limitation), Q9
watch (buried, undated), Q10 architecture (told, not shown). Fail: Q1 what
changed (nothing brings changes together across categories), Q5 drivers.
Fixed the same day: data-period label, recency chip, "Affects" line,
dated watch list, related-finding links, source links, Market Catalysts
layer, copy cleanup with a guard test, sticky section menu. Also built, for Q1:
a "What changed" lead list picked by fixed rules whenever no reasoned run
matches the data. Held: confidence on the card face (until findings stop
all reading low).

## Final engineering standard

Favor clarity over cleverness.

Favor evidence over narrative.

Favor deterministic calculations over LLM calculations.

Favor modularity over provider lock-in.

Favor a small number of excellent executive experiences over a large number of mediocre charts.

The final portfolio project should demonstrate both:

**strategic thinking** and **serious software/AI engineering**.
