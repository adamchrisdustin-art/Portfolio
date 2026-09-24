/**
 * Turns a set of real snapshot dates into the inputs TREND_FRAMEWORK.md's
 * classifyConfidence() needs - so every agent computes confidence from
 * actual accumulated history instead of hardcoding `false`. This is the
 * dynamic replacement for the hardcoded
 * `{ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false }`
 * every real agent used through Phase 5 - see each agent's file for how
 * it's used, and docs/cms-intelligence/AGENT_ARCHITECTURE.md's
 * cross-cutting rules for why this is now a shared requirement, not a
 * per-agent judgment call.
 */
import { directionOf, type Direction } from "../../intelligence/trends/trend";

/** Matches TREND_FRAMEWORK.md's "Baseline windows" section: 24 months, or the longest available history if less. */
const BASELINE_WINDOW_DAYS = 730;

export interface SnapshotHistoryAssessment {
  snapshotCount: number;
  earliestDate: string;
  latestDate: string;
  daysOfHistory: number;
  hasFullBaseline: boolean;
}

/** dates: ISO date strings (YYYY-MM-DD), any order, any duplicates collapsed. */
export function assessSnapshotHistory(dates: string[]): SnapshotHistoryAssessment {
  const unique = Array.from(new Set(dates)).sort();
  if (unique.length === 0) {
    throw new Error("assessSnapshotHistory: at least one snapshot date is required");
  }
  const earliest = unique[0];
  const latest = unique[unique.length - 1];
  const daysOfHistory = (new Date(latest).getTime() - new Date(earliest).getTime()) / 86_400_000;
  return {
    snapshotCount: unique.length,
    earliestDate: earliest,
    latestDate: latest,
    daysOfHistory,
    hasFullBaseline: daysOfHistory >= BASELINE_WINDOW_DAYS,
  };
}

/** Direction of a metric across consecutive real snapshots, in date order - feeds meetsPersistence(). */
export function directionsAcrossSnapshots(valuesInDateOrder: number[]): Direction[] {
  const directions: Direction[] = [];
  for (let i = 1; i < valuesInDateOrder.length; i++) {
    directions.push(directionOf(valuesInDateOrder[i], valuesInDateOrder[i - 1]));
  }
  return directions;
}

/** Extracts the YYYY-MM-DD stamp from a snapshot filename/path like ".../2026-09-23.json". */
export function dateFromSnapshotFilename(fileOrPath: string): string {
  const match = /(\d{4}-\d{2}-\d{2})\.json$/.exec(fileOrPath);
  if (!match) throw new Error(`Could not extract a date from snapshot filename: ${fileOrPath}`);
  return match[1];
}
