/**
 * Task-specific model routing - docs/cms-intelligence/
 * 06_PHASE_6_MODEL_PROVIDER_EVALUATION.md's "Model router concept":
 * "Route by demonstrated task performance and economics [...] Do not
 * route by model prestige." The category-to-tier mapping below predates
 * any live run; TIER_PROVIDER_DEFAULTS is now set from real measured
 * results (see its comment).
 */
import type { TaskCategory } from "./types";

export type ModelTier = "deterministic" | "efficient" | "strong";

const TASK_TIER: Record<TaskCategory, ModelTier> = {
  // Deterministic-first: this repo's real agents compute these categories with plain code today, not an LLM at all - see AGENT_ARCHITECTURE.md's "LLM vs. code split" per agent.
  "utilization-trend": "deterministic",
  "reimbursement-change": "deterministic",
  "geographic-comparison": "deterministic",
  "provider-concentration": "deterministic",
  "emerging-signal-detection": "deterministic",
  "source-provenance": "deterministic",
  // Simple classification/summarization - efficient tier (Haiku / gpt-4o-mini) per this repo's committed defaults.
  "policy-interpretation": "efficient",
  "site-of-care-change": "efficient",
  "ma-enrollment-summary": "efficient",
  "unsupported-inference-refusal": "efficient",
  // Requires weighing multiple real findings against each other without dropping one, or a coherent cross-cutting narrative - the two categories Phase 6 explicitly calls "complex cross-source synthesis" and "executive synthesis".
  "evidence-reconciliation": "strong",
  "executive-synthesis": "strong",
};

export function recommendTier(category: TaskCategory): ModelTier {
  return TASK_TIER[category];
}

/**
 * Updated 2026-09-25 from the six-model live benchmark (re-scored after the
 * scorer fixes - see MODEL_EVALUATION.md). Every model refused correctly
 * and made no forbidden claim, so the tiers differ on fact recall and
 * source citation: Opus 5.5 0.92, Sonnet 5 0.85, then Haiku 4.5, GPT-6 Sol,
 * gpt-4o-mini and GPT-6 Luna within noise of each other (0.68-0.74).
 * Efficient work goes to the cheapest model in that band (Adam's preference:
 * OpenAI for cheap tasks); strong work goes to the top scorer, since it's
 * one call a month. The live routing is run-monthly-reasoning.ts's defaults.
 */
export const TIER_PROVIDER_DEFAULTS: Record<Exclude<ModelTier, "deterministic">, { anthropic: string; openai: string }> = {
  efficient: { anthropic: "anthropic:claude-haiku-4-5-20251001", openai: "openai:gpt-6-luna" },
  strong: { anthropic: "anthropic:claude-opus-5-5", openai: "openai:gpt-6-sol" },
};
