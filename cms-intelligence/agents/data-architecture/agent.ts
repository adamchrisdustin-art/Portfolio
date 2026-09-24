/**
 * Data Architecture & Semantic Model agent - see docs/cms-intelligence/
 * AGENT_ARCHITECTURE.md section 12. Infrastructure agent: owns no
 * executive questions and has no LLM step - its actual "output" is the
 * shared schema/type modules under cms-intelligence/intelligence/ that
 * every other agent already imports (schema.ts, validate.ts, metrics.ts,
 * trend.ts, routing.ts), not a runtime Insight-producing call.
 *
 * Implements DomainAgent for interface consistency only - run() is a
 * no-op because this agent's real work happens at design/implementation
 * time (defining the shared model), not at query time.
 */
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext, DomainAgent } from "../types";

export const dataArchitectureAgent: DomainAgent = {
  id: "data-architecture-semantic-model",
  questionIds: [], // infrastructure agent - owns no executive questions, see AGENT_ARCHITECTURE.md section 12

  async run(_ctx: AgentContext): Promise<Insight[]> {
    return [];
  },
};
