/**
 * Runs every domain agent and groups the resulting insights by dashboard
 * layer (see cms-intelligence/agents/dashboardLayers.ts). This is a
 * different use case from orchestrator.ts's runOrchestrator (which
 * answers one targeted question by routing to specific agents) - the
 * dashboard needs "everything every agent currently knows," not a
 * routed query, so it gets its own function rather than overloading
 * runOrchestrator's signature.
 *
 * Zero cost to run - every agent's LLM step is already gated behind
 * ctx.modelProvider being non-null (see AGENT_ARCHITECTURE.md's
 * cost-gate rule), and this function always passes modelProvider: null,
 * matching COST_AND_OPERATING_MODEL.md's rule that the dashboard reads
 * pre-computed/cached results and never triggers a live LLM call.
 */
import { layerForQuestion, type DashboardLayer, ALL_LAYERS } from "../dashboardLayers";
import { ALL_AGENTS } from "../registry";
import type { Insight } from "../../intelligence/evidence/schema";
import { InsightValidationError } from "../../intelligence/evidence/validate";
import type { AgentContext } from "../types";
import { logAgentRun } from "../../observability/log";
import { synthesize } from "./synthesis";
import { applyRecency } from "../../intelligence/evidence/recency";
import { unchangedSinceBySource } from "../../reasoning/sourceFingerprints";

export interface AgentRunStatus {
  agentId: string;
  ok: boolean;
  insightCount: number;
  durationMs: number;
  modelProviderUsed: string | null;
  error?: string;
}

export interface FullSweepResult {
  generatedAt: string;
  totalDurationMs: number;
  insightsByLayer: Record<DashboardLayer, Insight[]>;
  allInsights: Insight[];
  agentStatuses: AgentRunStatus[];
  /** Executive Pulse's actual synthesized narrative - not just a ranked list of cards. See synthesis.ts. */
  synthesis: string;
  synthesisSource: "llm" | "rule-based";
}

/**
 * Never throws - a single agent's failure is captured as a status entry,
 * not a page-breaking error (Phase 5's "calculation failure" state).
 * Records per-agent wall-clock duration and which model provider (if
 * any) it used - deferred to Phase 6, but cheap to capture now so a
 * future monitoring view (agent runtimes/success rates, paired with
 * Phase 6's provider evaluation) doesn't need every agent re-touched.
 */
export async function runFullSweep(ctx: AgentContext = { modelProvider: null }): Promise<FullSweepResult> {
  const sweepStart = Date.now();
  const sweepId = new Date(sweepStart).toISOString();
  const insightsByLayer = Object.fromEntries(ALL_LAYERS.map((l) => [l, [] as Insight[]])) as Record<
    DashboardLayer,
    Insight[]
  >;
  const allInsights: Insight[] = [];
  const agentStatuses: AgentRunStatus[] = [];

  // Recency is judged against each source's update schedule once per sweep, so a source that resumes publishing becomes current again on its own.
  const unchangedSince = unchangedSinceBySource();
  const now = new Date(sweepStart);

  for (const agent of ALL_AGENTS) {
    const agentStart = Date.now();
    try {
      const insights = applyRecency(await agent.run(ctx), now, unchangedSince);
      const durationMs = Date.now() - agentStart;
      agentStatuses.push({
        agentId: agent.id,
        ok: true,
        insightCount: insights.length,
        durationMs,
        modelProviderUsed: ctx.modelProvider?.name ?? null,
      });
      for (const insight of insights) {
        insightsByLayer[layerForQuestion(insight.questionId)].push(insight);
        allInsights.push(insight);
      }
      logAgentRun({
        taskId: `${sweepId}:${agent.id}`,
        agentId: agent.id,
        provider: ctx.modelProvider?.name ?? null,
        model: null,
        latencyMs: durationMs,
        dataSourcesUsed: Array.from(new Set(insights.flatMap((i) => i.sourceIds))),
        success: true,
        validationResult: "passed",
      });
    } catch (err) {
      const durationMs = Date.now() - agentStart;
      agentStatuses.push({
        agentId: agent.id,
        ok: false,
        insightCount: 0,
        durationMs,
        modelProviderUsed: ctx.modelProvider?.name ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
      logAgentRun({
        taskId: `${sweepId}:${agent.id}`,
        agentId: agent.id,
        provider: ctx.modelProvider?.name ?? null,
        model: null,
        latencyMs: durationMs,
        dataSourcesUsed: [],
        success: false,
        validationResult: err instanceof InsightValidationError ? "failed-validation" : "failed-other",
      });
    }
  }

  const successfulAgentCount = agentStatuses.filter((s) => s.ok).length;
  const { synthesis, synthesisSource } = await synthesize(
    allInsights,
    `Swept ${successfulAgentCount} of ${ALL_AGENTS.length} specialist agents this cycle`,
    ctx
  );

  return {
    generatedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - sweepStart,
    insightsByLayer,
    allInsights,
    agentStatuses,
    synthesis,
    synthesisSource,
  };
}
