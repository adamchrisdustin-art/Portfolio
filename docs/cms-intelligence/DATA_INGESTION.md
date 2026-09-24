# Data Ingestion — Healthcare Intelligence Executive Dashboard

Phase 4 deliverable per `04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`'s "Data
pipeline requirements" section, which specifies nine steps per source:
discover metadata, fetch/load sample, validate schema, normalize types,
map dimensions, record provenance, calculate required metrics, store/
update source status, expose analytical data to agents. This document
maps each step to real code for the two implemented sources.

## The nine steps, as actually implemented

| Step | Implementation |
|---|---|
| 1. Discover metadata | Live metastore/datastore lookup (see `SOURCE_REGISTRY.md`'s verification process) — done manually during Phase 4 via `WebFetch`, recorded in `cms-intelligence/data/sources/registry.ts`. |
| 2. Fetch or load sample | `cms-intelligence/data/adapters/homeHealthCareAgencies.ts`'s `fetchAllRows()` (paginated, same pattern as `pipeline/pullCmsData.ts`); `hospitalGeneralInformation.ts` reads an already-pulled snapshot from Track C v1. |
| 3. Validate schema | Not yet automated for ingestion itself (the two datasets' schemas were confirmed manually via live `WebFetch` calls during Phase 4) — `cms-intelligence/data/sources/qualityChecks.ts`'s `checkSchemaDrift()` is the reusable building block for automating this on a future pull, not yet wired into a pull script. |
| 4. Normalize types | Minimal today — e.g. `claims-utilization-cost/agent.ts`'s `parseValidRatios()` converts CMS's string-typed numeric fields (`"0.94"`) to real numbers, explicitly excluding suppressed (`"-"`) values rather than coercing them. |
| 5. Map dimensions | Geography (`state` field) and population (`medicare-ffs` for both current sources) are mapped directly in each agent's `Insight` output per `EVIDENCE_MODEL.md`'s schema — a formal cross-dataset dimension-mapping layer is `data-architecture-semantic-model`'s future job as more sources are added (see `AGENT_ARCHITECTURE.md` section 12). |
| 6. Record provenance | `cms-intelligence/data/sources/provenance.ts`'s `CalculationProvenance` type, plus every `Insight`'s built-in `EvidenceRef`/`Freshness` fields — see `DATA_LINEAGE.md` for the full chain. |
| 7. Calculate required metrics | `cms-intelligence/intelligence/metrics/metrics.ts` (deterministic formulas) — e.g. `mixShare`/`concentrationRatio` in the Market Growth and Provider/Network agents, a plain average in the Claims/Utilization/Cost agent. |
| 8. Store/update source status | `cms-intelligence/agents/source-change-monitor/agent.ts`'s `checkAllSources()` — see `SOURCE_REGISTRY.md`. |
| 9. Expose analytical data to agents | Each adapter's `loadLatestSnapshot()`, called directly by the agent(s) that own the relevant questions (`cms-intelligence/agents/registry.ts` wires them together via the orchestrator). |

## Pull scripts

- `npx tsx cms-intelligence/data/adapters/pull-home-health.ts` — live pull
  for the Home Health Care Agencies dataset, writes to
  `data/healthcare-intelligence/home-health-care-agencies/snapshots/`.
  Zero API-key cost (public data, no LLM call) — safe to re-run any time.
- Hospital General Information continues to be pulled by Track C v1's
  existing `npm run cms:pull` (`pipeline/pullCmsData.ts`) — this system's
  adapter reads that output rather than duplicating the pull, per the
  documented exception in `PROJECT_BOUNDARY.md`.

## Cadence

Per `COST_AND_OPERATING_MODEL.md`'s 2026-09-23 update: quarterly-to-annual,
capped at quarterly even where a source updates more often, since this is
a portfolio demonstration, not a live monitoring system. No cron workflow
exists yet for the new Home Health adapter — running it is currently
manual (`npx tsx ...`), matching this project's actual current cadence
need. A scheduled workflow is a Phase 5 (or later) addition once there's
a real reason to automate beyond manual re-runs during active development.
