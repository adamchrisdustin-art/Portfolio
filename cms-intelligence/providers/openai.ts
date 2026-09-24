/**
 * OpenAI provider - same request/response shape as pipeline/analystAgent.ts
 * (direct fetch to the Responses API, no SDK dependency), reimplemented
 * behind the ModelProvider interface so agents in cms-intelligence/ don't
 * depend on OpenAI's shape directly. gpt-4o-mini default matches
 * CLAUDE.md's budget guardrail for this provider.
 */
import type { GenerateOptions, ModelProvider } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_OUTPUT_TOKENS = 400;

export function createOpenAIProvider(apiKey: string, model: string = DEFAULT_MODEL): ModelProvider {
  return {
    name: `openai:${model}`,
    async generate(options: GenerateOptions): Promise<string | null> {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_output_tokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          input: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
        }),
      });

      if (!res.ok) {
        console.error(`[openai-provider] call failed: ${res.status} ${res.statusText}`);
        return null;
      }

      const body = await res.json();
      const text = body.output
        ?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
        .map((c: { text?: string }) => c.text)
        .filter(Boolean)
        .join("\n");

      return text || null;
    },
  };
}
