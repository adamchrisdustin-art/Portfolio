/**
 * Phase 6 evaluation framework types - see
 * docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md for the
 * full spec this implements. Deliberately independent of the intelligence
 * layer's own Insight schema (intelligence/evidence/schema.ts) - this
 * evaluates the LLM synthesis step itself (Phase 6's "critical
 * architecture principle": the evaluation framework must stay portable
 * across providers, never assume any one provider's output shape).
 */

export type TaskCategory =
  | "utilization-trend"
  | "reimbursement-change"
  | "policy-interpretation"
  | "geographic-comparison"
  | "provider-concentration"
  | "site-of-care-change"
  | "ma-enrollment-summary"
  | "emerging-signal-detection"
  | "evidence-reconciliation"
  | "unsupported-inference-refusal"
  | "source-provenance"
  | "executive-synthesis";

/**
 * A single benchmark task, matching the phase doc's "golden evaluation
 * record" shape (task_id/question/expected_sources/required_facts/
 * forbidden_claims/quality_criteria), renamed to this repo's camelCase
 * convention. `context` is the real, grounded data given to the model -
 * every fact in it traces back to this repo's own committed snapshots
 * and agent output (see benchmarkSuite.ts's header for how each task was
 * derived), never an invented CMS fact.
 */
export interface BenchmarkTask {
  taskId: string;
  category: TaskCategory;
  /** The prompt sent to the model as GenerateOptions.user. */
  question: string;
  /** Real grounding data given to the model as part of the prompt - see GenerateOptions.system in runner.ts. */
  context: string;
  /** Real sourceIds (from cms-intelligence/data/sources/registry.ts) the answer should reference. */
  expectedSources: string[];
  /** Substrings a correct answer should contain (case-insensitive) - real facts, not paraphrase-matching. */
  requiredFacts: string[];
  /** Substrings/phrases whose presence indicates a governance failure (fabrication, unsupported causality, a named real insurer). */
  forbiddenClaims: string[];
  /** True when the only correct answer is "insufficient/no data" - required facts are ignored for these; the answer must actually decline. */
  expectRefusalOrGap: boolean;
  /** Human-readable rubric notes surfaced in the comparison report - not auto-scored beyond required/forbidden/refusal checks. */
  qualityCriteria: string[];
}

export interface EvaluationResult {
  taskId: string;
  category: TaskCategory;
  providerName: string;
  rawOutput: string | null;
  latencyMs: number;
  /** The provider call completed without throwing and returned non-empty text. */
  ranSuccessfully: boolean;
  factsFound: string[];
  factsMissing: string[];
  forbiddenClaimsTriggered: string[];
  citedExpectedSource: boolean;
  /** null when the task doesn't require a refusal; true/false = did the model correctly decline (or correctly not decline). */
  refusalCorrect: boolean | null;
  /** 0-1 composite - see scorer.ts for the exact weighting. */
  score: number;
  notes: string[];
}

export interface ProviderAggregate {
  meanScore: number;
  schemaComplianceRate: number; // fraction of tasks that ran successfully and returned parseable, non-empty text
  forbiddenClaimRate: number; // fraction of tasks that triggered at least one forbidden claim - lower is better
  refusalAccuracy: number | null; // fraction of refusal-required tasks correctly declined
  sourceCitationRate: number; // fraction of tasks that cited an expected source
  meanLatencyMs: number;
  totalRuns: number;
  failedRuns: number;
}

export interface ProviderRunResult {
  providerName: string;
  results: EvaluationResult[];
  aggregate: ProviderAggregate;
}

export interface ModelPricing {
  providerName: string; // matches ModelProvider.name, e.g. "anthropic:claude-haiku-4-5-20251001"
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  /** How/when this number was actually confirmed - never a guessed price, same discipline as SOURCE_REGISTRY.md. */
  verifiedVia: string;
  verifiedOn: string; // ISO date
}

export interface CostEstimate {
  providerName: string;
  costPerQuestionUsd: number;
  costPerInsightUsd: number;
  costPerDashboardRefreshUsd: number;
  costPerMonitoringRunUsd: number;
  assumptions: string[];
}
