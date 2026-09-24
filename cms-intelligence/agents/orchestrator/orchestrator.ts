/**
 * Executive Orchestrator - see docs/cms-intelligence/AGENT_ARCHITECTURE.md
 * section 1. Routes a set of executive question IDs to the specialist
 * agents that own them, collects their validated Insight objects, ranks
 * them, and produces a synthesized narrative via synthesis.ts (shared
 * with fullSweep.ts's dashboard-wide sweep).
 */
import { getAgentById } from "../registry";
import { routeQuestions } from "../routing";
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext } from "../types";
import { synthesize } from "./synthesis";

export interface OrchestratorResult {
  insights: Insight[];
  invokedAgentIds: string[];
  synthesis: string;
  synthesisSource: "llm" | "rule-based";
}

function rankInsights(insights: Insight[]): Insight[] {
  const confidenceWeight: Record<Insight["confidence"], number> = { high: 3, medium: 2, low: 1 };
  return [...insights].sort((a, b) => confidenceWeight[b.confidence] - confidenceWeight[a.confidence]);
}

/**
 * Runs the orchestrator for a given list of executive question IDs.
 * Satisfies 03_PHASE_3_AGENT_IMPLEMENTATION.md's acceptance criterion:
 * a query touching >= 2 question categories invokes >= 2 specialist
 * agents and returns a synthesized result with evidence-backed insights.
 */
export async function runOrchestrator(questionIds: string[], ctx: AgentContext): Promise<OrchestratorResult> {
  const invokedAgentIds = routeQuestions(questionIds);

  const results = await Promise.all(
    invokedAgentIds.map(async (agentId) => {
      const agent = getAgentById(agentId);
      if (!agent) return [];
      return agent.run(ctx);
    })
  );

  const insights = rankInsights(results.flat());
  const { synthesis, synthesisSource } = await synthesize(
    insights,
    `Queried ${invokedAgentIds.length} specialist agent(s) (${invokedAgentIds.join(", ")})`,
    ctx
  );

  return { insights, invokedAgentIds, synthesis, synthesisSource };
}
