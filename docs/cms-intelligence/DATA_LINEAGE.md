# Data Lineage — Healthcare Intelligence Executive Dashboard

Phase 4 deliverable per `04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`'s
"Required outputs" list. Traces one real insight end-to-end from source to
dashboard-ready output — the concrete proof behind this phase's
acceptance criterion ("source, transformation, calculation, and resulting
insight all traceable").

## Worked example: the Home Health episode-spending baseline

```
CMS Provider Data Catalog (live API)
  https://data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0
        |
        v  cms-intelligence/data/adapters/homeHealthCareAgencies.ts
           fetchAndSnapshot() - paginated fetch, 12,460 real rows
        |
        v  data/healthcare-intelligence/home-health-care-agencies/
           snapshots/2026-09-23.json  (committed to git - inspectable)
        |
        v  cms-intelligence/agents/claims-utilization-cost/agent.ts
           parseValidRatios() - normalizes the
           "how_much_medicare_spends_on_an_episode_of_care..." field,
           excludes suppressed ("-") values (12,460 rows in, N valid
           ratios out - N is data-dependent, computed at run time, not
           hardcoded)
        |
        v  plain arithmetic mean (documented inline, not hidden behind
           an opaque helper - this specific calculation is simple enough
           not to need a named function in metrics.ts)
        |
        v  cms-intelligence/intelligence/evidence/validate.ts
           validateInsight() - structural check before the Insight is
           ever returned
        |
        v  Insight object (id: sig-claims-cost-<date>-home-health-
           spending-ratio), questionId Q012, signalType "baseline"
        |
        v  cms-intelligence/agents/orchestrator/orchestrator.ts
           runOrchestrator() - ranks by confidence, synthesizes
        |
        v  (Phase 5) dashboard Layer 3 "Claims & Cost" - not built yet
```

Every arrow above is either a real, committed file this repo already
contains, or a real function that runs against that file (verified via
`cms-intelligence/agents/claims-utilization-cost/agent.test.ts`, which
runs the actual pipeline against the actual committed snapshot, not a
mock).

## Provenance fields carried at each stage

- **Source stage**: `SourceRegistryEntry.sourceId`,
  `.urlOrApi`, `.lastVerified` (`SOURCE_REGISTRY.md`).
- **Snapshot stage**: `pulledAt` timestamp embedded in the snapshot file
  itself (`homeHealthCareAgencies.ts`'s `HomeHealthSnapshot.pulledAt`).
- **Calculation stage**: `CalculationProvenance`
  (`cms-intelligence/data/sources/provenance.ts`) — not yet attached to
  every insight as a literal field (that would duplicate
  `EvidenceRef`/`Freshness` for the two current single-calculation
  agents), but available for any future agent whose calculation involves
  multiple transformation steps worth distinguishing.
- **Insight stage**: `Insight.evidence[].sourceId` +
  `.datasetVintage`, `Insight.freshness.dataAsOf` — the fields every
  dashboard card will actually read from in Phase 5.

## Two real lineages exist today

The same pattern applies to the Market Growth and Provider & Network
agents' insights, both built in Phase 3 against the Hospital General
Information dataset — see those two agents' own file headers for their
specific transformation/calculation steps. This document worked through
the Home Health example because it's Phase 4's newly added path; the
Hospital General Information lineage is structurally identical, just
against a different source and calculation.
