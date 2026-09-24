/**
 * Formal calculation-provenance record, per docs/cms-intelligence/
 * 04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md's "Provenance" section. This is
 * a superset of what EvidenceRef (intelligence/evidence/schema.ts)
 * already carries on every Insight - EvidenceRef answers "what source
 * backs this claim," CalculationProvenance additionally answers "what
 * exact transformation/calculation produced this specific number,"
 * useful for debugging a metric back to the literal code path that made
 * it, not just the dataset.
 */

export interface CalculationProvenance {
  sourceDatasetId: string; // joins to SourceRegistryEntry.sourceId
  sourceVintage: string; // ISO date - which snapshot was used
  period: { start: string; end: string };
  /** Human-readable description of what was done to the raw rows, e.g. "filtered suppressed cells, averaged remaining values." */
  transformation: string;
  /** Name of the deterministic function that performed the calculation, e.g. "concentrationRatio" - traceable back to intelligence/metrics/metrics.ts. */
  calculation: string;
  refreshDate: string; // ISO datetime - when this specific calculation was run
}

export function describeProvenance(p: CalculationProvenance): string {
  return `${p.calculation}(${p.transformation}) over ${p.sourceDatasetId}@${p.sourceVintage}, period ${p.period.start}–${p.period.end}, computed ${p.refreshDate}`;
}
