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

export type { GenerateOptions, ModelProvider } from "./types";
