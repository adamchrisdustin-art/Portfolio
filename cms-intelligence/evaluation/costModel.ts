/**
 * Cost estimation - docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md's
 * "Economics" section. Pricing below was verified live on 2026-09-23 (not
 * assumed from training knowledge, which is stale by the time any given
 * conversation runs) via claude.com/pricing and a cross-checked web
 * search of OpenAI's published per-token rates - same "never invent a
 * fact" discipline data/sources/registry.ts applies to CMS datasets,
 * applied here to pricing. Re-verify before relying on these for a real
 * budget decision - provider pricing changes over time and this file
 * will drift, same caveat SOURCE_REGISTRY.md gives its own entries.
 *
 * Traced against this repo's actual LLM call sites (2026-09-23): exactly
 * one place calls a model today - cms-intelligence/agents/orchestrator/
 * synthesis.ts's executive-narrative step, gated behind a non-null
 * ctx.modelProvider and capped at 300 output tokens, called once per
 * fullSweep() run. No agent computes its own insight via an LLM call -
 * every real agent's math is deterministic code (AGENT_ARCHITECTURE.md's
 * "LLM vs. code split" rule). The estimators below model that real
 * shape, not a hypothetical heavier one.
 */
import { BENCHMARK_MAX_OUTPUT_TOKENS } from "./runner";
import type { CostEstimate, ModelPricing } from "./types";

export const MODEL_PRICING: ModelPricing[] = [
  {
    providerName: "anthropic:claude-haiku-4-5-20251001",
    inputPerMillionUsd: 1,
    outputPerMillionUsd: 5,
    verifiedVia: "claude.com/pricing (live fetch)",
    verifiedOn: "2026-09-23",
  },
  {
    providerName: "anthropic:claude-sonnet-5",
    inputPerMillionUsd: 2,
    outputPerMillionUsd: 10,
    verifiedVia: "claude.com/pricing (live fetch)",
    verifiedOn: "2026-09-23",
  },
  {
    // Must match the real API model ID exactly (claude-opus-5-5, hyphens) - a "5.5" spelling here made every Opus run report "unpriced".
    providerName: "anthropic:claude-opus-5-5",
    inputPerMillionUsd: 4,
    outputPerMillionUsd: 20,
    verifiedVia: "claude.com/pricing (live fetch)",
    verifiedOn: "2026-09-23",
  },
  {
    providerName: "openai:gpt-4o-mini",
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
    verifiedVia: "web search cross-check of OpenAI published pricing (openai.com/api/pricing returned 403 to a direct fetch)",
    verifiedOn: "2026-09-23",
  },
  {
    providerName: "openai:gpt-6-luna",
    inputPerMillionUsd: 0.1,
    outputPerMillionUsd: 0.5,
    verifiedVia: "developers.openai.com/api/docs/pricing (live fetch), cross-checked against launch coverage (VentureBeat, MarkTechPost)",
    verifiedOn: "2026-09-25",
  },
  {
    providerName: "openai:gpt-6-sol",
    inputPerMillionUsd: 2,
    outputPerMillionUsd: 10,
    verifiedVia: "developers.openai.com/api/docs/pricing (live fetch), cross-checked against launch coverage (VentureBeat, MarkTechPost)",
    verifiedOn: "2026-09-25",
  },
  {
    providerName: "openai:gpt-4.1-mini",
    inputPerMillionUsd: 0.4,
    outputPerMillionUsd: 1.6,
    verifiedVia: "web search cross-check of OpenAI published pricing",
    verifiedOn: "2026-09-23",
  },
  {
    providerName: "openai:gpt-4o",
    inputPerMillionUsd: 2.5,
    outputPerMillionUsd: 10,
    verifiedVia: "web search cross-check of OpenAI published pricing",
    verifiedOn: "2026-09-23",
  },
];

export function getPricing(providerName: string): ModelPricing | undefined {
  return MODEL_PRICING.find((p) => p.providerName === providerName);
}

function callCostUsd(pricing: ModelPricing, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * pricing.inputPerMillionUsd + (outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
}

/**
 * Real shape observed in this repo, not a hypothetical: one synthesis
 * call per fullSweep(), input = JSON of up to ~9 real insights'
 * headline/magnitude/confidence/businessRelevance (observed ~800-1,500
 * tokens for the current insight count), output capped at 300 tokens
 * (synthesis.ts's maxOutputTokens). Per-question/per-insight estimates
 * use the benchmark suite's own observed token usage instead (see
 * runner.ts), since those are single-task calls, not a whole-sweep call.
 */
const OBSERVED_SYNTHESIS_INPUT_TOKENS = 1200;
const OBSERVED_SYNTHESIS_OUTPUT_TOKENS = 300;
/** Average observed input tokens for one benchmark-suite task (system + user + context) - see benchmarkSuite.ts. */
const OBSERVED_TASK_INPUT_TOKENS = 220;
const OBSERVED_TASK_OUTPUT_TOKENS_CAP = BENCHMARK_MAX_OUTPUT_TOKENS;

export function estimateCost(providerName: string): CostEstimate | null {
  const pricing = getPricing(providerName);
  if (!pricing) return null;

  const costPerQuestionUsd = callCostUsd(pricing, OBSERVED_TASK_INPUT_TOKENS, OBSERVED_TASK_OUTPUT_TOKENS_CAP);
  // One insight roughly maps to one benchmark-style question-and-answer today, since no agent yet makes its own per-insight LLM call (see file header).
  const costPerInsightUsd = costPerQuestionUsd;
  const costPerDashboardRefreshUsd = callCostUsd(pricing, OBSERVED_SYNTHESIS_INPUT_TOKENS, OBSERVED_SYNTHESIS_OUTPUT_TOKENS);
  // Quarterly cadence per COST_AND_OPERATING_MODEL.md - "monitoring run" here means one scheduled fullSweep + synthesis call, not per-visitor.
  const costPerMonitoringRunUsd = costPerDashboardRefreshUsd;

  return {
    providerName,
    costPerQuestionUsd,
    costPerInsightUsd,
    costPerDashboardRefreshUsd,
    costPerMonitoringRunUsd,
    assumptions: [
      `Pricing verified ${pricing.verifiedOn} via ${pricing.verifiedVia} - re-verify before a real spend decision.`,
      "The live dashboard itself never calls an LLM (runFullSweep() defaults to modelProvider: null) - these are estimates for a deliberate scheduled/backfill run, not per-visitor traffic.",
      `costPerDashboardRefreshUsd models the one real LLM call site in this repo today (synthesis.ts, ~${OBSERVED_SYNTHESIS_INPUT_TOKENS} input / ${OBSERVED_SYNTHESIS_OUTPUT_TOKENS} output tokens observed).`,
      "costPerQuestionUsd/costPerInsightUsd model one benchmark-style task call at this agent's output cap - real per-agent LLM insight generation isn't implemented yet (every agent's math is deterministic code as of 2026-09-23).",
    ],
  };
}

export function estimateAllConfiguredCosts(): CostEstimate[] {
  return MODEL_PRICING.map((p) => estimateCost(p.providerName)).filter((e): e is CostEstimate => e !== null);
}

/** Projects a quarterly-cadence yearly cost for a given provider - matches COST_AND_OPERATING_MODEL.md's "quarterly to annual" run cadence, 4 runs/year ceiling. */
export function projectAnnualCostUsd(providerName: string, runsPerYear: number = 4): number | null {
  const estimate = estimateCost(providerName);
  if (!estimate) return null;
  return estimate.costPerMonitoringRunUsd * runsPerYear;
}
