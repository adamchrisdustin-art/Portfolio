# Schema Mapping — Healthcare Intelligence Executive Dashboard

Phase 4 deliverable per `04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`'s
"Required outputs" list. Documents how each implemented source's raw
fields map onto this system's canonical dimensions
(`cms-intelligence/intelligence/evidence/schema.ts`'s `Population`,
`Geography`, `Period` types) — the concrete, current-state answer to
`AGENT_ARCHITECTURE.md` section 12's semantic-model responsibility.

## Population mapping

| Source | Raw field(s) | Canonical `PopulationType` | Notes |
|---|---|---|---|
| Hospital General Information | *(none — facility directory, not a claims/enrollment file)* | `medicare-ffs` | Assigned by convention: CMS Provider Data Catalog facility directories describe providers serving the Medicare FFS-adjacent population by default; this is a simplification flagged explicitly, not a claim that these facilities serve *only* FFS beneficiaries. |
| Home Health Care Agencies | *(none — same directory shape)* | `medicare-ffs` | Same convention and same caveat as above. |

Neither implemented source actually carries a population field in its raw
data — both are provider/facility directories, not enrollment or claims
files. The `medicare-ffs` assignment is a documented simplification for
these two specific sources, not a general mapping rule. A future
enrollment- or claims-level source (e.g. `cms:ma-part-d-enrollment`) would
carry a real population field requiring a real mapping, not this
convention — don't copy this shortcut forward without checking the new
source's actual data first.

## Geography mapping

| Source | Raw field | Canonical `Geography` |
|---|---|---|
| Hospital General Information | `state` | `{ level: "state", code: <2-letter state>, label: <derived> }` |
| Home Health Care Agencies | `state`, `zip_code` | `{ level: "state", code: <2-letter state>, label: <derived> }` (zip available but not yet used at that grain) |

Both sources use USPS state abbreviations directly as `Geography.code` —
not a FIPS code. `EVIDENCE_MODEL.md`'s `Geography.code` comment already
allows this ("FIPS code, state abbreviation, CBSA code, etc. — format
depends on level"), so this is a valid choice, not a shortcut needing a
fix — but any future source using FIPS codes for state will need an
explicit state-abbreviation ↔ FIPS crosswalk before the two can be
compared or joined, per the master orchestrator's "never combine datasets
without checking definitions" rule. No such crosswalk exists yet because
no second geography encoding has been introduced yet.

## Grain / identifier mapping

| Source | Row grain | Identifier field | Used as `EvidenceRef`/diff key |
|---|---|---|---|
| Hospital General Information | one hospital | `facility_id` | Yes — `cms-intelligence/agents/source-change-monitor/agent.ts` diffs on this field |
| Home Health Care Agencies | one home health agency | `cms_certification_number_ccn` | Yes — same diffing pattern |

## Time/period mapping

Neither source currently carries a real multi-period time dimension in
its raw rows — both are point-in-time snapshots (CMS publishes the
*current* state of each directory, not a historical time series via this
API). This system builds its own history by re-pulling on its own cadence
and diffing (see `DATA_INGESTION.md`) — every `Insight`'s `Period.start`
and `Period.end` are currently set to the snapshot's own pull date for
both implemented sources, which is why every real insight produced so far
carries `signalType: "baseline"`, never `"trend"` — there is no real
period range to report yet, only a point-in-time read. This will change
once at least two meaningfully different snapshots of the same source
exist.

## What's intentionally not mapped yet

Units, grain, and geography for every **candidate** (unverified) source
in `SOURCE_REGISTRY.md` — mapping a field that hasn't been confirmed to
exist would mean guessing at a schema, which this project's "never invent
a source" discipline extends to schema mapping as much as source
discovery. Map a candidate's schema only after promoting it to
verified-implemented.
