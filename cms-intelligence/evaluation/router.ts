/**
 * Task-specific model routing - docs/cms-intelligence/
 * 06_PHASE_6_MODEL_PROVIDER_EVALUATION.md's "Model router concept":
 * "Route by demonstrated task performance and economics [...] Do not
 * route by model prestige." Since no live evaluation run has happened
 * yet (no API key is configured anywhere in this project as of
 * 2026-09-23 - see MANIFEST.md), there is no measured performance data
 * to route on. This file therefore encodes the *default* tier mapping
 * this repo's providers already commit to in code (Haiku for Anthropic,
 * gpt-4o-mini for OpenAI - see providers/anthropic.ts and
 * providers/openai.ts's DEFAULT_MODEL, and CLAUDE.md's budget guardrail
 * requiring that default) plus the one escalation path Phase 6 asks for
 * (executive synthesis -> a stronger tier), rather than pretend a
 * measured routing decision exists before real evaluation data does.
 * `recommendTier` should be revisited once runSuite() has real results
 * across providers - see comparisonReport.ts's TODO note.
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

export const TIER_PROVIDER_DEFAULTS: Record<Exclude<ModelTier, "deterministic">, { anthropic: string; openai: string }> = {
  efficient: { anthropic: "anthropic:claude-haiku-4-5-20251001", openai: "openai:gpt-4o-mini" },
  strong: { anthropic: "anthropic:claude-sonnet-5", openai: "openai:gpt-4.1-mini" },
};
