# PHASE 5 — EXECUTIVE DASHBOARD & UX

## Claude Code task

Build the visible portfolio experience.

This is an executive intelligence product, not an analytics playground.

## UX principle

Leadership should understand the most important development within seconds.

The dashboard should answer:

- What changed?
- Why does it matter?
- Where?
- For whom?
- How confident are we?
- What should I look at next?

## Required pages/layers

### 1. Executive Pulse

The default view.

Show a small number of high-value intelligence cards.

Each must contain:

- headline
- change
- magnitude
- geography
- why it matters
- evidence
- freshness
- confidence
- next signal

Avoid dozens of competing KPIs.

### 2. Market & Growth

Include:

- geography
- enrollment
- market growth
- utilization
- spend
- provider growth
- service-line growth
- market composition
- CMS program participation

Allow:

National → State → MSA/County/market → Provider ecosystem

### 3. Claims & Cost

Include:

- utilization trends
- PMPM
- cost per episode
- cost per unit
- utilization/cost decomposition
- site of care
- high-growth services
- high-growth conditions
- emerging therapies

### 4. Reimbursement & Provider Economics

Include:

- CMS benchmark
- internal/demo reimbursement
- benchmark relationship
- specialty
- geography
- provider variation
- payment policy changes

Use precise terminology.

Do not call Medicare payment amounts "commercial reimbursement rates."

### 5. Provider & Network

Include:

- provider growth
- ownership changes
- concentration
- new providers
- exits
- capacity
- service-line concentration
- relevant market movement

### 6. Policy & Program Watch

Use a timeline:

**Announced → Proposed → Final → Effective → Observable**

Each item should connect:

Policy → affected population → market → service → provider → financial mechanism → internal indicator

### 7. Emerging Signals

Show discoveries that were not predefined KPIs.

This page should make the product feel agentic.

## Evidence interaction

A user should be able to open an insight and see:

- source(s)
- source date
- population
- calculation
- evidence excerpt or metadata
- confidence
- limitations
- related signals

Do not expose hidden chain-of-thought.

## Visual design

Follow the existing portfolio design system after repository discovery.

Do not create a disconnected mini-brand unless appropriate.

The dashboard should look like a polished strategy/product demonstration.

Prioritize:

- information hierarchy
- whitespace
- readable typography
- restrained charts
- clear annotation
- accessible contrast
- responsive behavior
- fast loading

## States

Implement:

- loading
- empty
- stale data
- source failure
- calculation failure
- no result
- low-confidence insight

## Demo mode

The portfolio must remain usable without confidential or production credentials.

Create a clearly labeled demo/public-data mode.

Do not pretend demo data is UHC data.

## Required portfolio storytelling

Add a project page or case-study section containing:

### Problem

Healthcare leadership has more data than attention.

### Approach

A coordinated agent system turns public and enterprise-ready data into evidence-backed executive intelligence.

### Architecture

Show:

- dashboard
- orchestrator
- domain agents
- data adapters
- source monitor
- analytics layer
- model provider interface

### Data

Explain which CMS data is used and why.

### Intelligence

Explain how the system distinguishes signal from noise.

### Evaluation

Explain how agent quality and model providers are compared.

### Future state

Explain how internal claims/membership/provider data could plug into the same architecture.

## Acceptance criteria

A new visitor can understand the project, interact with it, inspect evidence, and understand why the architecture matters without reading the source code.
