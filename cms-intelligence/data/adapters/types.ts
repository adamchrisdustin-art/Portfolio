/**
 * Public-data-first adapter interfaces, per docs/cms-intelligence/
 * 04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md's "Public-data-first
 * architecture" section: interfaces that could later accept an internal
 * UHC/Optum-like dataset without embedding proprietary assumptions, but
 * for this portfolio are backed only by public CMS data, synthetic
 * datasets, or static fixtures - never real employer/client data
 * (CLAUDE.md guardrail).
 *
 * Each interface is intentionally minimal - just enough shape to prove
 * the abstraction is real and swappable, not a speculative full data
 * model for a category with no implementation yet (Phase 1's "don't
 * overbuild" guidance). Expand a given interface only when a real
 * adapter needs the extra shape, not preemptively.
 */

export interface MembershipAdapter {
  sourceId: string;
  /** Enrollment count for a population/geography/period - see METRIC_DICTIONARY.md "Enrollment." */
  getEnrollmentCount(params: { geography: string; period: string }): Promise<number | null>;
}

export interface ClaimsAdapter {
  sourceId: string;
  getUtilizationCount(params: { serviceCategory: string; geography: string; period: string }): Promise<number | null>;
}

export interface ProviderAdapter {
  sourceId: string;
  getProviderCount(params: { geography?: string; providerType?: string }): Promise<number | null>;
}

export interface ReimbursementAdapter {
  sourceId: string;
  getRate(params: { procedureOrDrg: string; locality: string; period: string }): Promise<number | null>;
}

export interface PharmacyAdapter {
  sourceId: string;
  getDrugSpend(params: { drugCategory: string; period: string }): Promise<number | null>;
}

export interface NetworkAdapter {
  sourceId: string;
  getConcentrationRatio(params: { geography: string; topN: number }): Promise<number | null>;
}
