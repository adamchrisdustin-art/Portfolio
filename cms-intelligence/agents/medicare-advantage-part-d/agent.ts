/**
 * Medicare Advantage & Part D Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 6. Also jointly
 * owns Q096-Q101 (Pharmacy & Part D economics) per routing.ts.
 *
 * No data source wired yet - Phase 4 adds MA/Part D enrollment, Star
 * Ratings, and PBP public files. Returns [] rather than fabricate a
 * finding.
 */
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext, DomainAgent } from "../types";

export const medicareAdvantagePartDAgent: DomainAgent = {
  id: "medicare-advantage-part-d-intelligence",
  questionIds: [
    "Q046", "Q047", "Q048", "Q049", "Q050", "Q051", "Q052", "Q053", "Q054", "Q055",
    "Q096", "Q097", "Q098", "Q099", "Q100", "Q101",
  ],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    return [];
  },
};
