/**
 * Provider selection - picks a ModelProvider from whatever API key is
 * available in the environment, or returns null if none is set. Every
 * caller must handle null: per COST_AND_OPERATING_MODEL.md and
 * AGENT_ARCHITECTURE.md's cost-gate rule, "no provider configured" is a
 * normal, expected, zero-cost state, not an error condition.
 *
 * Preference order (Anthropic first) matches CLAUDE.md's stated direction
 * that Claude API is this project's intended primary provider going
 * forward, with OpenAI as the already-proven fallback from pipeline/.
 */
import { createAnthropicProvider } from "./anthropic";
import { createOpenAIProvider } from "./openai";
import type { ModelProvider } from "./types";

export function getConfiguredProvider(): ModelProvider | null {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return createAnthropicProvider(anthropicKey);

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) return createOpenAIProvider(openaiKey);

  return null;
}

/**
 * Builds a provider from a "provider:model" spec (e.g. "openai:gpt-6-luna",
 * "anthropic:claude-sonnet-5"), so autonomous runs can route each task to
 * a different model through config alone. Returns null when the spec is
 * malformed or that provider's key isn't set - the same "no provider is a
 * normal state" contract as getConfiguredProvider().
 */
export function createProviderFromSpec(
  spec: string | undefined,
  env: Record<string, string | undefined> = process.env
): ModelProvider | null {
  const [provider, ...rest] = (spec ?? "").trim().split(":");
  const model = rest.join(":");
  if (!model) return null;
  if (provider === "anthropic" && env.ANTHROPIC_API_KEY) return createAnthropicProvider(env.ANTHROPIC_API_KEY, model);
  if (provider === "openai" && env.OPENAI_API_KEY) return createOpenAIProvider(env.OPENAI_API_KEY, model);
  return null;
}

export type { GenerateOptions, ModelProvider } from "./types";
