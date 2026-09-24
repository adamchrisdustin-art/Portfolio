/**
 * Contract every domain agent implements - see docs/cms-intelligence/
 * AGENT_ARCHITECTURE.md for each agent's actual responsibilities. This
 * file only defines the shared shape so the orchestrator can treat all
 * 12 agents uniformly ("a maintainable multi-agent architecture, not
 * twelve independent chatbots" - 03_PHASE_3_AGENT_IMPLEMENTATION.md).
 */
import type { ModelProvider } from "../providers/types";
import type { Insight } from "../intelligence/evidence/schema";

export interface AgentContext {
  /** null when no provider is configured - agents must degrade gracefully, never throw on this. */
  modelProvider: ModelProvider | null;
}

export interface DomainAgent {
  /** Matches the slug used in AGENT_ARCHITECTURE.md and .claude/agents/<id>.md. */
  id: string;
  /** Question IDs from EXECUTIVE_QUESTION_CATALOG.md this agent owns (primary ownership only - see routing.ts for joint-ownership notes). */
  questionIds: string[];
  /**
   * Returns zero or more validated Insight objects. An agent with no wired
   * data source yet returns an empty array - never a fabricated result.
   * Phase 3 wires real data for 2 of the 12 agents (market-growth,
   * provider-network) as the vertical-slice demo; the rest return []
   * pending Phase 4's data sourcing.
   */
  run(ctx: AgentContext): Promise<Insight[]>;
}
