# Evidence Model — Healthcare Intelligence Executive Dashboard

Phase 2 deliverable per `02_PHASE_2_INTELLIGENCE_BLUEPRINT.md` §3. Defines
the canonical `Insight` object every agent must emit, adapted to this
repo's TypeScript/JSON stack (per Phase 1's discovery: strict TS, JSON
files on disk, no database).

Owned conceptually by the Data Architecture & Semantic Model agent
(`AGENT_ARCHITECTURE.md` §12). Lives at
`cms-intelligence/intelligence/evidence/schema.ts` once Phase 3 implements
it — this document is the design that file must match, not the
implementation itself.

## Design goals

- Matches the master orchestrator's **Executive Intelligence Standard**
  exactly: Signal → Magnitude → Location → Population → Time → Driver →
  Business Relevance → Evidence → Contradictory Evidence → Confidence →
  Freshness → Next Signal → Internal Validation.
- Every field that could be misread as more certain than it is (magnitude,
  drivers, confidence) has an explicit place for the *limitation* or
  *contradictory evidence* that keeps it honest — the schema itself
  enforces the master orchestrator's "never hide data limitations" rule
  structurally, the same way `Reimbursement`'s `status` field structurally
  enforces "never represent proposed policy as final."
- One `Insight` = one traceable claim. A dashboard card, chart annotation,
  or narrative sentence must always be able to point at one or more
  `Insight` IDs — never an unattributed number on a chart.

## TypeScript schema

```typescript
// cms-intelligence/intelligence/evidence/schema.ts

export type SignalType = "trend" | "anomaly" | "policy" | "structural-change" | "baseline";
export type ConfidenceLevel = "low" | "medium" | "high";
export type PopulationType = "medicare-ffs" | "medicare-advantage" | "part-d" | "medicaid" | "chip" | "dual-eligible" | "marketplace" | "cross-population" | "n/a";

export interface Period {
  start: string; // ISO date
  end: string;   // ISO date
  /** true when this period is being compared to a prior period of the same
   * length elsewhere in the insight (e.g. YoY) - lets the UI render "vs.
   * what" without re-deriving it. */
  isComparisonWindow?: boolean;
}

export interface Geography {
  level: "national" | "state" | "county" | "cbsa" | "hrr" | "rating-area" | "plan-service-area";
  /** FIPS code, state abbreviation, CBSA code, etc. - format depends on level. */
  code: string;
  /** Human-readable label for display - never rely on `code` alone in UI copy. */
  label: string;
}

export interface Magnitude {
  /** The measured value itself, in the metric's native unit. */
  value: number;
  unit: string; // e.g. "per-1000", "USD-PMPM", "percent", "count"
  /** What this is being compared against, if applicable (see METRIC_DICTIONARY.md "benchmark"). */
  comparedTo?: string;
  /** The delta vs. `comparedTo`, same unit as `value`. */
  delta?: number;
  deltaPercent?: number;
}

export interface Driver {
  description: string;
  /** Never assert causality without evidence - this field must always be
   * paired with at least one entry in `evidence` that supports it. */
  supportingEvidenceIds: string[];
  /** Explicit per the master orchestrator: correlation is not causation
   * unless a stated mechanism exists. */
  relationship: "correlation" | "stated-mechanism" | "confirmed-causal";
}

export interface EvidenceRef {
  id: string;
  sourceId: string; // joins to the source registry, cms-intelligence/data/sources/
  description: string;
  datasetVintage: string; // ISO date of the underlying data's as-of date
  url?: string;
}

export interface Freshness {
  /** As-of date of the underlying data, not the date this insight was generated. */
  dataAsOf: string;
  /** When this insight was computed. */
  generatedAt: string;
  /** Flags data that's stale relative to the source's expected cadence -
   * set by the Data Source & CMS Change Monitor agent, not self-reported. */
  isStale: boolean;
}

export interface Insight {
  id: string; // e.g. "sig-2026-09-23-mkt-004"
  headline: string; // human-readable, one sentence
  questionId: string; // joins to EXECUTIVE_QUESTION_CATALOG.md, e.g. "Q004"
  signalType: SignalType;
  period: Period;
  population: PopulationType;
  geography: Geography;
  magnitude: Magnitude;
  drivers: Driver[];
  businessRelevance: string; // plain-language "why this matters" - see writing style rules below
  evidence: EvidenceRef[];
  contradictoryEvidence: EvidenceRef[]; // explicitly required, can be empty array but the field must exist
  confidence: ConfidenceLevel;
  confidenceRationale: string; // ties back to TREND_FRAMEWORK.md's confidence criteria - never a bare label with no reasoning
  freshness: Freshness;
  limitations: string[]; // never omit this array even when short - "no known limitations beyond standard public-data caveats" is a valid but explicit entry
  nextSignal: string; // what to watch for next, per the master orchestrator's standard
  recommendedInternalValidation: string; // what a human/internal system should check before acting
  sourceIds: string[]; // all source registry IDs this insight touches, for the "every source maps back to questions" acceptance criterion
  generatingAgent: string; // which of the 12 agents produced this, for traceability
  series?: InsightSeries; // added Phase 5 addendum (2026-09-23) - see below
}

export interface SeriesPoint {
  date: string; // ISO date - the real snapshot vintage this point came from
  value: number;
}

/**
 * Optional real time-series backing a dashboard chart. Only ever built
 * from actual snapshot history (cms-intelligence/data/sources/
 * snapshotHistory.ts) - never fabricated or interpolated between real
 * points. Omit this field entirely rather than inventing a point for a
 * date with no real pull.
 */
export interface InsightSeries {
  label: string;
  unit: string;
  points: SeriesPoint[];
}
```

## Example instance

```json
{
  "id": "sig-2026-09-23-mkt-004",
  "headline": "MA enrollment in three Southeast Michigan counties grew faster than the state average for the third consecutive quarter.",
  "questionId": "Q046",
  "signalType": "trend",
  "period": { "start": "2025-10-01", "end": "2026-06-30" },
  "population": "medicare-advantage",
  "geography": { "level": "county", "code": "26163", "label": "Wayne County, MI" },
  "magnitude": {
    "value": 6.2,
    "unit": "percent",
    "comparedTo": "Michigan statewide MA enrollment growth",
    "delta": 3.8,
    "deltaPercent": 158
  },
  "drivers": [
    {
      "description": "Two new MA plan service-area expansions filed in the county during the prior quarter.",
      "supportingEvidenceIds": ["ev-pbp-2026-q2-001"],
      "relationship": "stated-mechanism"
    }
  ],
  "businessRelevance": "A market growing this much faster than its state average for three straight quarters is worth checking for network-adequacy or competitive-response planning before the next enrollment cycle.",
  "evidence": [
    { "id": "ev-enroll-2026-06", "sourceId": "cms:ma-monthly-enrollment", "description": "CMS MA monthly enrollment file, June 2026", "datasetVintage": "2026-06-01" },
    { "id": "ev-pbp-2026-q2-001", "sourceId": "cms:plan-benefit-package", "description": "PBP filing showing two service-area expansions", "datasetVintage": "2026-04-01" }
  ],
  "contradictoryEvidence": [],
  "confidence": "medium",
  "confidenceRationale": "Trend persisted 3 consecutive quarters (meets TREND_FRAMEWORK.md persistence threshold) and has a stated mechanism, but has not yet been corroborated by a second independent dataset (e.g. provider capacity growth in the same county).",
  "freshness": { "dataAsOf": "2026-06-01", "generatedAt": "2026-09-23T14:02:00Z", "isStale": false },
  "limitations": [
    "County-level MA enrollment reflects plan-reported service areas, not confirmed member addresses.",
    "This is public plan-level data - it says nothing about any specific payer's own membership."
  ],
  "nextSignal": "Watch for a Q3 2026 provider-capacity signal in the same county (agent #5) to corroborate whether supply is keeping pace.",
  "recommendedInternalValidation": "Cross-check against internal MA membership figures for the same counties if this pattern is being used for real planning, not just portfolio demonstration.",
  "sourceIds": ["cms:ma-monthly-enrollment", "cms:plan-benefit-package"],
  "generatingAgent": "market-growth-geographic-intelligence"
}
```

## Field-by-field notes tying back to project rules

- `population` is a closed enum, not a free-text string — this is the
  schema-level enforcement of "never equate Medicare FFS with MA" and
  "never equate MA with [any specific payer's] performance." An agent
  cannot emit an insight with an ambiguous population.
- `drivers[].relationship` forces every stated driver to declare whether
  it's correlation, a stated mechanism, or confirmed-causal — an agent
  cannot claim causality by omission.
- `contradictoryEvidence` is a required array (can be empty, but the field
  must be present) so that "we checked and found nothing contradictory" is
  distinguishable from "we didn't check."
- `freshness.isStale` is set by the Data Source & CMS Change Monitor agent
  (#11), not self-reported by the emitting agent — keeps one agent from
  under-flagging its own staleness.
- `businessRelevance` is the one field most likely to end up verbatim in
  published dashboard copy — per the public-copy rule in
  `AGENT_ARCHITECTURE.md`, this field must never name a real company.

## Storage convention

Matches the existing `data/cms/<dataset>/{snapshots,diffs,briefs}` pattern
from `pipeline/lib/paths.ts`, adapted: `data/healthcare-intelligence/
insights/<YYYY-MM-DD>/<insight-id>.json`, one file per insight, dated by
generation cycle — inspectable via git history, no database required,
consistent with Phase 1's discovery that this repo has no DB layer and
doesn't need one for this scale of data.
