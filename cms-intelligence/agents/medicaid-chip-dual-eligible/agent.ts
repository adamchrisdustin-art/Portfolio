/**
 * Medicaid, CHIP & Dual Eligible Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 7.
 *
 * No data source wired yet - Phase 4 adds T-MSIS / Medicaid.gov
 * state-level data. Returns [] rather than fabricate a finding. Note
 * per AGENT_ARCHITECTURE.md: this category's real output must always
 * carry per-state data-vintage labeling once implemented, since state
 * reporting cadence varies.
 */
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext, DomainAgent } from "../types";

export const medicaidChipDualEligibleAgent: DomainAgent = {
  id: "medicaid-chip-dual-eligible-intelligence",
  questionIds: ["Q056", "Q057", "Q058", "Q059", "Q060", "Q061", "Q062", "Q063", "Q064", "Q065"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    return [];
  },
};
