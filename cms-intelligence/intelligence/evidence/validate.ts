/**
 * Hand-rolled runtime validator for Insight objects, not a schema library
 * (zod/ajv/etc.) - consistent with the rest of this repo, which has no
 * validation dependency anywhere (see docs/cms-intelligence/
 * REPOSITORY_DISCOVERY.md). Add a real library only if this grows past
 * what a plain function can readably check.
 *
 * Every domain agent's output passes through this before becoming part of
 * an orchestrator result - "structured output, always" per
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md's cross-cutting rules.
 */
import type { ConfidenceLevel, Insight, PopulationType, SignalType } from "./schema";

const SIGNAL_TYPES: SignalType[] = ["trend", "anomaly", "policy", "structural-change", "baseline"];
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["low", "medium", "high"];
const POPULATION_TYPES: PopulationType[] = [
  "medicare-ffs",
  "medicare-advantage",
  "part-d",
  "medicaid",
  "chip",
  "dual-eligible",
  "marketplace",
  "cross-population",
  "n/a",
];

export class InsightValidationError extends Error {
  constructor(message: string) {
    super(`Invalid Insight: ${message}`);
    this.name = "InsightValidationError";
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InsightValidationError(`"${field}" must be a non-empty string`);
  }
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new InsightValidationError(`"${field}" must be an array (present even if empty)`);
  }
  return value;
}

/**
 * Throws InsightValidationError on the first problem found. Returns the
 * input, narrowed to Insight, on success - callers should treat a thrown
 * error as "do not emit this insight," per the master orchestrator's
 * "return insufficient-evidence instead of a bad result" rule.
 */
export function validateInsight(candidate: unknown): Insight {
  if (typeof candidate !== "object" || candidate === null) {
    throw new InsightValidationError("must be an object");
  }
  const c = candidate as Record<string, unknown>;

  requireString(c.id, "id");
  requireString(c.headline, "headline");
  requireString(c.questionId, "questionId");

  if (!SIGNAL_TYPES.includes(c.signalType as SignalType)) {
    throw new InsightValidationError(`"signalType" must be one of ${SIGNAL_TYPES.join(", ")}`);
  }
  if (!POPULATION_TYPES.includes(c.population as PopulationType)) {
    throw new InsightValidationError(`"population" must be one of ${POPULATION_TYPES.join(", ")}`);
  }
  if (!CONFIDENCE_LEVELS.includes(c.confidence as ConfidenceLevel)) {
    throw new InsightValidationError(`"confidence" must be one of ${CONFIDENCE_LEVELS.join(", ")}`);
  }
  requireString(c.confidenceRationale, "confidenceRationale");
  // A bare confidence label with no reasoning is explicitly disallowed -
  // see docs/cms-intelligence/EVIDENCE_MODEL.md's field notes.
  if ((c.confidenceRationale as string).trim().length < 10) {
    throw new InsightValidationError(
      '"confidenceRationale" must actually explain the confidence level, not restate it'
    );
  }

  requireString(c.businessRelevance, "businessRelevance");
  requireString(c.nextSignal, "nextSignal");
  requireString(c.recommendedInternalValidation, "recommendedInternalValidation");
  requireString(c.generatingAgent, "generatingAgent");

  const evidence = requireArray(c.evidence, "evidence");
  if (evidence.length === 0) {
    throw new InsightValidationError("must cite at least one evidence reference - never a bare claim");
  }
  requireArray(c.contradictoryEvidence, "contradictoryEvidence");
  requireArray(c.limitations, "limitations");
  requireArray(c.drivers, "drivers");
  requireArray(c.sourceIds, "sourceIds");
  if ((c.sourceIds as unknown[]).length === 0) {
    throw new InsightValidationError('"sourceIds" must be non-empty - every insight traces back to a source');
  }

  for (const d of c.drivers as Record<string, unknown>[]) {
    if (!["correlation", "stated-mechanism", "confirmed-causal"].includes(d.relationship as string)) {
      throw new InsightValidationError(
        'every driver must declare "relationship" as correlation, stated-mechanism, or confirmed-causal'
      );
    }
    if (!Array.isArray(d.supportingEvidenceIds) || d.supportingEvidenceIds.length === 0) {
      throw new InsightValidationError("every driver must cite supportingEvidenceIds - never assert a driver without evidence");
    }
  }

  const period = c.period as Record<string, unknown> | undefined;
  if (!period || typeof period.start !== "string" || typeof period.end !== "string") {
    throw new InsightValidationError('"period" must have string "start" and "end" dates');
  }

  const geography = c.geography as Record<string, unknown> | undefined;
  if (!geography || typeof geography.code !== "string" || typeof geography.label !== "string") {
    throw new InsightValidationError('"geography" must have "code" and "label"');
  }

  const magnitude = c.magnitude as Record<string, unknown> | undefined;
  if (!magnitude || typeof magnitude.value !== "number" || typeof magnitude.unit !== "string") {
    throw new InsightValidationError('"magnitude" must have a numeric "value" and a "unit"');
  }

  const freshness = c.freshness as Record<string, unknown> | undefined;
  if (
    !freshness ||
    typeof freshness.dataAsOf !== "string" ||
    typeof freshness.generatedAt !== "string" ||
    typeof freshness.isStale !== "boolean"
  ) {
    throw new InsightValidationError('"freshness" must have "dataAsOf", "generatedAt", and boolean "isStale"');
  }

  return candidate as Insight;
}
