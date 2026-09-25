/**
 * Anthropic (Claude) provider - direct fetch to the Messages API, no SDK
 * dependency, matching this repo's existing zero-SDK pattern for LLM
 * calls (see pipeline/analystAgent.ts). claude-haiku default per
 * CLAUDE.md's budget guardrail: "Any Claude API usage in agents defaults
 * to Haiku; escalate to Sonnet only where reasoning quality clearly
 * requires it." This is the first Claude API integration in the repo -
 * CLAUDE.md previously documented this as a planned v2, not yet built.
 */
import type { GenerateOptions, ModelProvider } from "./types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_OUTPUT_TOKENS = 400;
const ANTHROPIC_VERSION = "2023-06-01";

export function createAnthropicProvider(apiKey: string, model: string = DEFAULT_MODEL): ModelProvider {
  return {
    name: `anthropic:${model}`,
    async generate(options: GenerateOptions): Promise<string | null> {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          system: options.system,
          messages: [{ role: "user", content: options.user }],
        }),
      });

      if (!res.ok) {
        console.error(`[anthropic-provider] call failed: ${res.status} ${res.statusText}`);
        return null;
      }

      const body = await res.json();
      if (body.stop_reason === "max_tokens") {
        console.warn(`[anthropic-provider] ${model} response truncated at the output-token cap`);
      }
      const text = body.content
        ?.map((block: { type?: string; text?: string }) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n");

      return text || null;
    },
  };
}
