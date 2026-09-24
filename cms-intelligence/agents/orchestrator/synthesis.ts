/**
 * Shared narrative-synthesis logic, extracted from orchestrator.ts so
 * both the per-question orchestrator and fullSweep.ts's dashboard sweep
 * use the same rule-based/LLM split rather than duplicating it. Same
 * cost-gate shape as pipeline/analystAgent.ts.
 */
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext } from "../types";

export interface SynthesisResult {
  synthesis: string;
  synthesisSource: "llm" | "rule-based";
}

export function ruleBasedSynthesis(insights: Insight[], context: string): string {
  if (insights.length === 0) {
    return `${context}; no insights were available yet - see each agent's file for its data-sourcing status.`;
  }
  const lines = [`${context}; ${insights.length} insight(s) returned:`];
  for (const insight of insights) {
    lines.push(`- [${insight.confidence}] ${insight.headline} (${insight.generatingAgent}, question ${insight.questionId})`);
  }
  return lines.join("\n");
}

async function llmSynthesis(insights: Insight[], ctx: AgentContext): Promise<string | null> {
  if (!ctx.modelProvider || insights.length === 0) return null; // cost gate - see AGENT_ARCHITECTURE.md cross-cutting rules
  return ctx.modelProvider.generate({
    system:
      "You synthesize structured healthcare-market insights into a short executive narrative. 2-4 sentences. Use only the facts given - never invent a number, source, or company name. Never name a specific real health insurer.",
    user: `Synthesize these insights for an executive reader:\n${JSON.stringify(insights.map((i) => ({ headline: i.headline, magnitude: i.magnitude, confidence: i.confidence, businessRelevance: i.businessRelevance })))}`,
    maxOutputTokens: 300,
  });
}

export async function synthesize(insights: Insight[], context: string, ctx: AgentContext): Promise<SynthesisResult> {
  const llm = await llmSynthesis(insights, ctx);
  return { synthesis: llm ?? ruleBasedSynthesis(insights, context), synthesisSource: llm ? "llm" : "rule-based" };
}
