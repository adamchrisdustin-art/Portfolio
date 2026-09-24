# Trend Framework — Healthcare Intelligence Executive Dashboard

Phase 2 deliverable per `02_PHASE_2_INTELLIGENCE_BLUEPRINT.md` §5. Defines
how a raw number becomes a trustworthy "trend," "anomaly," or "emerging
signal" rather than noise — the mechanical rules behind
`EVIDENCE_MODEL.md`'s `confidence` and `confidenceRationale` fields, and
the direct implementation of the master orchestrator's rule: **do not call
a movement an emerging trend after one observation unless an external
event clearly explains it.**

Owned by the Data Architecture & Semantic Model agent, implemented as code
(per `AGENT_ARCHITECTURE.md`'s cross-cutting "deterministic-first" rule —
nothing in this document is an LLM judgment call). Lives at
`cms-intelligence/intelligence/trends/` once implemented.

## Baseline windows

Every trend calculation needs a stated baseline to compare against.
Default baseline window: **trailing 8 quarters (24 months)** of the same
metric/population/geography, or the longest available history if less
than 24 months exists (in which case `confidence` is capped at `low` —
see Confidence below). A shorter baseline may be used only when a metric's
own natural cycle is shorter than 24 months (e.g., a rule-cycle-driven
Policy metric may use the current and prior CMS rule year as its baseline)
— any such exception must be stated in the insight's `limitations` field.

## Rolling averages

Two standard windows, used consistently across all agents:

- **3-period rolling average** — smooths short-term noise for
  quarter-to-quarter reporting.
- **12-period (or 12-month) rolling average** — the primary baseline
  against which a current value's deviation is measured for anomaly
  detection (see below).

Agents must not invent their own ad hoc window length without documenting
why the standard 3- or 12-period window doesn't fit that specific metric.

## Year-over-year (YoY) comparison

**Formula:** current period vs. the same-length period exactly one year
prior, same population/geography. YoY is the default comparison for any
metric with known or suspected seasonality (see Seasonality below) —
comparing YoY instead of period-over-period is this framework's primary
defense against mistaking a seasonal pattern for a real trend.

## Acceleration

Per `METRIC_DICTIONARY.md`: the change in the growth rate itself between
two consecutive periods. Requires ≥3 periods of history. An acceleration
finding (Q002-class questions) is reported with `signalType: "trend"` only
once it holds across ≥2 consecutive periods (see Persistence) — a single
period of acceleration is reported, if at all, as `signalType: "anomaly"`
with explicitly lower confidence.

## Change points

**Method:** a simple threshold-based structural-break check — flag a
change point where a rolling-average value moves more than the anomaly
threshold (below) away from its own prior rolling average, sustained for
at least 2 consecutive periods afterward. This is deliberately a simple,
explainable method (not a full statistical change-point-detection model)
consistent with Phase 1's "don't overbuild prematurely" — a more
sophisticated method can replace this later if the simple version proves
insufficient, but starts here.

## Anomaly thresholds

**Method:** a value is flagged as a statistical anomaly when it falls
more than **2 standard deviations** (or, for small/skewed samples, more
than **2× the median absolute deviation, MAD**) from its trailing 12-period
rolling mean. MAD is used instead of standard deviation whenever the
sample is small (see Minimum sample sizes) or visibly skewed, since
standard deviation is unreliable in both cases.

An anomaly is *not* automatically an emerging trend — it is reported as
`signalType: "anomaly"` and only reclassified to `"trend"` after meeting
the Persistence rule below.

## Minimum sample sizes

This system must respect CMS's own public-data suppression rules, not
work around them. CMS commonly suppresses cells with fewer than **11**
individuals/events for privacy. This framework adopts the same floor:

- Any denominator or numerator below 11 is treated as suppressed —
  never estimated, imputed, or backed into via a workaround.
- Any rate/metric computed from a suppressed cell is not reported; the
  insight is not generated for that geography/period, full stop.
- This applies transitively: a metric that depends on a suppressed
  upstream value (e.g., a rate whose denominator itself came from a
  suppressed source) is also not reported.

## Suppression

Beyond the CMS 11-count floor: this system never publishes a value that a
source dataset has itself marked as suppressed or redacted for any reason
(not just small-cell privacy) — the suppression flag is propagated as-is,
never overridden by a downstream calculation that happens to produce a
number anyway.

## Seasonality

A metric is treated as seasonal by default if its category is known to
have a seasonal pattern in CMS data (e.g., enrollment activity spikes
around Medicare's Annual Election Period; certain service categories have
known seasonal utilization patterns, e.g., respiratory-related services).
For seasonal metrics:

- YoY (not sequential period-over-period) is the default comparison.
- A sequential-period change that's fully explained by a known seasonal
  pattern is not reported as a trend or anomaly — it's expected.
- A sequential-period change that *exceeds* the same metric's typical
  historical seasonal swing is still eligible to be flagged, but the
  insight's `limitations` field must state the seasonal baseline it was
  compared against, not just the raw prior period.

## Persistence

**Rule (directly implementing the master orchestrator's explicit
instruction):** a movement is not labeled `signalType: "trend"` (as
opposed to `"anomaly"`) unless it holds across **at least 2 consecutive
periods** in the same direction, *or* a specific, named external event
(a policy change, a corroborating Policy-agent signal, a known market
event) clearly and specifically explains a single-period movement — and
that explanation must itself be cited as an `EvidenceRef` in the
insight's `evidence` array, not asserted without a source.

## External corroboration

Confidence increases when a signal is corroborated by a *second,
independent* dataset or agent (see `AGENT_ARCHITECTURE.md`'s Emerging
Trends agent, Q088). "Independent" specifically means: not derived from
the same underlying source dataset, and ideally not produced by the same
domain agent. A signal seen in two views of the same underlying dataset
(e.g., a rate and its own raw counts) is not corroboration — it's the
same evidence presented twice.

## Confidence

Three tiers, each requiring the stated criteria — not a subjective label:

| Tier | Criteria (all must hold) |
|---|---|
| `low` | Fewer than 2 periods of persistence, OR baseline window shorter than 24 months with no stated exception, OR no external corroboration and the metric is not a well-established, low-noise measure (e.g., raw enrollment counts). |
| `medium` | Meets the Persistence rule (≥2 periods or a cited external event) AND has a full 24-month (or documented-exception) baseline, but lacks independent external corroboration. |
| `high` | Meets the Persistence rule AND has a full baseline AND has independent external corroboration from a second dataset/agent. |

Every insight's `confidenceRationale` field must name which of these
criteria were met and which weren't — "high confidence" with no stated
reasoning is not a valid output anywhere in this system, per
`EVIDENCE_MODEL.md`'s schema design.

## Watch-list mechanism (Q065/Q083)

Signals that cross the anomaly threshold or the ownership/policy
materiality threshold (see `AGENT_ARCHITECTURE.md` §5/§7's Q041/Q058-class
filtering) but haven't yet met the Persistence rule are held on an
explicit **watch-list**, not discarded and not prematurely reported as a
trend. A watch-list entry is promoted to a full `Insight` once it meets
Persistence, or expires after a defined window (default: 4 periods with
no confirming movement) if it doesn't. This is the literal implementation
of Q065 ("which state-level signals deserve monitoring") and Q083's
equivalent for CMS programs — both questions describe this mechanism,
not a one-time finding.

## Materiality threshold (used across multiple agents' filtering questions)

A single, shared definition used everywhere a "does this matter enough to
report" filter is needed (Q041–Q043, Q050, Q058): a change is material if
it either (a) exceeds the anomaly threshold above, or (b) affects a
population/volume/dollar amount above a stated absolute floor specific to
that metric family (defined per-metric when each agent is implemented in
Phase 3, since the right floor differs by scale — e.g., a meaningful
ownership change threshold differs from a meaningful enrollment-count
threshold). The *shape* of the rule (relative anomaly OR absolute floor)
is fixed here; the specific floor values are a Phase 3 implementation
detail, not a Phase 2 blueprint detail.
