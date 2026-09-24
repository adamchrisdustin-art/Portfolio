# Data Quality — Healthcare Intelligence Executive Dashboard

Phase 4 deliverable per `04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`'s "Data
quality" section. Implementation:
`cms-intelligence/data/sources/qualityChecks.ts` (8 unit-tested functions,
see `qualityChecks.test.ts`).

## Checks implemented

| Required check | Function | What it catches |
|---|---|---|
| Missing fields | `checkMissingFields` | Rows lacking a required field (undefined, null, or empty string). |
| Duplicate identifiers | `checkDuplicateIdentifiers` | The same identifier value appearing on more than one row — a sign of a bad join or a source publishing genuine duplicates. |
| Unexpected category values | `checkUnexpectedCategoryValues` | A field's actual values falling outside a defined allow-list — e.g. an ownership-type value CMS hasn't used before. |
| Impossible dates | `checkImpossibleDates` | A date-like field that doesn't parse to a real date. |
| Unexplained volume changes | `checkUnexplainedVolumeChange` | A row-count swing between two snapshots larger than a configurable threshold (default 25%) — more likely a schema/scope change than a real signal. |
| Schema drift | `checkSchemaDrift` | Fields present in one pull but missing (error) or newly added (warning) in the next. |
| Unexpected geographic loss | `checkUnexpectedGeographicLoss` | A geography (e.g. a state) present in a prior pull but absent from the current one — could mean CMS dropped coverage, or could mean a pull failed partway through. |
| Suspicious joins | *(not implemented as a standalone function)* | Handled at the point of use instead — e.g. `claims-utilization-cost/agent.ts`'s explicit exclusion of suppressed values rather than joining/averaging through them; `data-architecture-semantic-model`'s role (`AGENT_ARCHITECTURE.md` §12) is to review any proposed cross-source join before it ships, which is a design-review process, not a single reusable function. |

## Where these run today

Not yet wired into an automated pre-flight step on every pull — currently
available as library functions any adapter or agent can call, and
exercised directly by their own unit tests
(`cms-intelligence/data/sources/qualityChecks.test.ts`). Wiring these into
`pull-home-health.ts` (and a future generalized pull script) so a quality
report is generated automatically alongside every snapshot is a natural
next step, not yet done — consistent with Phase 1's "don't overbuild
prematurely": the checks exist and are proven correct against real
inputs/outputs, but automatic invocation on every pull is deferred until
there's a second or third pull to actually compare against (right now,
Home Health has exactly one snapshot, so several of these checks —
volume-change, schema-drift, geographic-loss — have nothing to compare
yet).

## Severity convention

Every `QualityIssue` carries `severity: "warning" | "error"`. The
convention used across all checks: **error** means the data is unsafe to
use as-is (all rows missing a required field, a duplicate identifier that
would corrupt a join, a removed field a calculation depends on, a
geography that disappeared). **warning** means the data is usable but
worth a human's attention (some rows missing a field, new unclassified
category values, a new field appeared). `runAllChecks()` aggregates a set
of check results and reports `hasErrors` so a caller can decide whether to
block on the result.
