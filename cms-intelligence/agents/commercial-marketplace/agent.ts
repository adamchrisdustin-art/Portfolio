/**
 * Commercial / Marketplace Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 8.
 *
 * No data source wired yet - Phase 4 adds CMS Marketplace Public Use
 * Files. Returns [] rather than fabricate a finding.
 */
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext, DomainAgent } from "../types";

export const commercialMarketplaceAgent: DomainAgent = {
  id: "commercial-marketplace-intelligence",
  questionIds: ["Q066", "Q067", "Q068", "Q069", "Q070", "Q071", "Q072"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    return [];
  },
};
