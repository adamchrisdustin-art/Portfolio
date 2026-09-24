/**
 * Source registry entry shape - every field docs/cms-intelligence/
 * 04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md's "Source registry" section
 * requires. See registry.ts for actual entries.
 */

export type VerificationStatus =
  /** Live-queried at least once, real field-level schema confirmed, an adapter exists. */
  | "verified-implemented"
  /** Live-queried to confirm it exists and is reachable, but no adapter built yet. */
  | "verified-not-implemented"
  /** Named in the master orchestrator's Phase 4 source list but not yet independently confirmed live - do not treat details below as confirmed until verified. */
  | "candidate-unverified";

export interface SourceRegistryEntry {
  sourceId: string; // stable id, e.g. "cms:home-health-care-agencies"
  sourceName: string;
  owner: string; // publishing agency, e.g. "CMS"
  urlOrApi: string | null; // null when candidate-unverified and no confirmed endpoint exists yet
  datasetDescription: string;
  population: string; // free text - which PopulationType(s) this touches
  geography: string; // grain description, e.g. "facility-level, with state/zip fields"
  grain: string; // one row = what
  latestVintage: string | null; // ISO date, null if unverified
  publicationDate: string | null;
  updateFrequency: string; // e.g. "annual", "quarterly", "unknown - needs verification"
  expectedNextUpdate: string | null;
  identifiers: string[]; // key fields that identify a row, e.g. ["cms_certification_number_ccn"]
  joinKeys: string[]; // fields usable to join against other sources, e.g. ["state", "cms_certification_number_ccn"]
  historicalCoverage: string; // e.g. "current snapshot only - CMS does not publish historical vintages via this API"
  restrictions: string; // e.g. "none - public, unauthenticated" or "requires DUA"
  knownSuppression: string; // e.g. "cells with fewer than 11 patients suppressed as '-'"
  knownLimitations: string[];
  methodologyNotes: string;
  lastVerified: string | null; // ISO date this entry's live status was actually checked
  lastSchemaCheck: string | null; // ISO date field names were actually confirmed against a live response
  changeStatus: "stable" | "unknown" | "flagged-for-review";
  verificationStatus: VerificationStatus;
  /** Which executive question IDs this source is relevant to - required by the acceptance criterion "every source maps back to questions." */
  relatedQuestionIds: string[];
}
