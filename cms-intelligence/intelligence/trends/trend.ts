/**
 * Deterministic implementations of docs/cms-intelligence/
 * TREND_FRAMEWORK.md's rules. See that doc for the full rationale behind
 * each threshold - this file only encodes the mechanics.
 */

/** CMS suppresses small cells for privacy; this system respects the same floor. */
export const SUPPRESSION_FLOOR = 11;

export function isSuppressed(count: number): boolean {
  return count < SUPPRESSION_FLOOR;
}

/**
 * Flags a value as a statistical anomaly vs. its trailing rolling mean.
 * Uses standard-deviation by default; pass method "mad" for small/skewed
 * samples per TREND_FRAMEWORK.md's guidance.
 */
export function isAnomaly(
  value: number,
  rollingMean: number,
  spread: number,
  method: "stddev" | "mad" = "stddev"
): boolean {
  if (spread <= 0) return false;
  const threshold = method === "stddev" ? 2 * spread : 2 * spread; // both use a 2x multiplier per the framework
  return Math.abs(value - rollingMean) > threshold;
}

export type Direction = "up" | "down" | "flat";

export function directionOf(current: number, prior: number): Direction {
  if (current > prior) return "up";
  if (current < prior) return "down";
  return "flat";
}

/**
 * A movement only counts as a trend (not just an anomaly) once it holds
 * across >= 2 consecutive periods in the same direction - the master
 * orchestrator's explicit "don't call one observation an emerging trend"
 * rule, made mechanical.
 */
export function meetsPersistence(directions: Direction[]): boolean {
  if (directions.length < 2) return false;
  const last = directions[directions.length - 1];
  const secondLast = directions[directions.length - 2];
  return last !== "flat" && last === secondLast;
}

export interface ConfidenceInputs {
  persistenceMet: boolean;
  /** true once >= 24 months (or a documented exception) of baseline history exists. */
  hasFullBaseline: boolean;
  /** true when a second, independent dataset/agent corroborates the same signal. */
  hasExternalCorroboration: boolean;
}

export interface ConfidenceResult {
  level: "low" | "medium" | "high";
  rationale: string;
}

/** Implements TREND_FRAMEWORK.md's three-tier confidence table exactly. */
export function classifyConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const { persistenceMet, hasFullBaseline, hasExternalCorroboration } = inputs;

  if (persistenceMet && hasFullBaseline && hasExternalCorroboration) {
    return {
      level: "high",
      rationale: "Meets persistence, has a full baseline window, and is corroborated by an independent source.",
    };
  }
  if (persistenceMet && hasFullBaseline) {
    return {
      level: "medium",
      rationale: "Meets persistence and has a full baseline window, but lacks independent external corroboration.",
    };
  }
  return {
    level: "low",
    rationale: !persistenceMet
      ? "Does not yet meet the 2-consecutive-period persistence rule."
      : "Baseline window is shorter than 24 months with no documented exception.",
  };
}
