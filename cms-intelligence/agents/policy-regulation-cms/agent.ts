/**
 * Policy, Regulation & CMS Program Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 9. Also jointly
 * owns Q102-Q107 (Value-Based Care) per routing.ts's assignment to
 * provider-network - this agent contributes the CMMI/MSSP program-level
 * side per AGENT_ARCHITECTURE.md, invoked directly by callers who need
 * that specific angle rather than through the routing table.
 *
 * No data source wired yet - Phase 4 adds Federal Register / CMS
 * newsroom / regulations.gov / CMMI tracking. Returns [] rather than
 * fabricate a finding.
 */
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext, DomainAgent } from "../types";

export const policyRegulationCmsAgent: DomainAgent = {
  id: "policy-regulation-cms-program-intelligence",
  questionIds: ["Q073", "Q074", "Q075", "Q076", "Q077", "Q078", "Q079", "Q080", "Q081", "Q082", "Q083", "Q084"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    return [];
  },
};
