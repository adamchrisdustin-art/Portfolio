/**
 * Which real providers/models an evaluation script runs through, from env:
 * ANTHROPIC_API_KEY / OPENAI_API_KEY, plus optional comma-separated
 * ANTHROPIC_MODEL / OPENAI_MODEL lists (each model becomes its own row).
 */
import { createAnthropicProvider } from "../providers/anthropic";
import { createOpenAIProvider } from "../providers/openai";
import type { ModelProvider } from "../providers/types";

/** undefined in the returned list means "use that provider's own default model". */
function modelList(envValue: string | undefined): (string | undefined)[] {
  return envValue ? envValue.split(",").map((m) => m.trim()).filter(Boolean) : [undefined];
}

export function configuredProviders(env: Record<string, string | undefined> = process.env): ModelProvider[] {
  const providers: ModelProvider[] = [];
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;
  if (anthropicKey) for (const model of modelList(env.ANTHROPIC_MODEL)) providers.push(createAnthropicProvider(anthropicKey, model));
  if (openaiKey) for (const model of modelList(env.OPENAI_MODEL)) providers.push(createOpenAIProvider(openaiKey, model));
  return providers;
}
