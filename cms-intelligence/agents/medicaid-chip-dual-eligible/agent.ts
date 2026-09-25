/**
 * Medicaid, CHIP & Dual Eligible Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 7.
 *
 * First real source wired 2026-09-25: the states' monthly Medicaid and
 * CHIP enrollment reports on data.medicaid.gov (enrollmentInsights.ts,
 * Q056). Each state figure names its own report month and status, per
 * the section 7 requirement that this category label vintage per state.
 * Questions without a public source yet (churn Q057, provider networks
 * Q059, behavioral health Q062, LTSS Q063) return nothing rather than a
 * fabricated finding.
 */
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext, DomainAgent } from "../types";
import { medicaidEnrollmentInsights } from "./enrollmentInsights";

export const medicaidChipDualEligibleAgent: DomainAgent = {
  id: "medicaid-chip-dual-eligible-intelligence",
  questionIds: ["Q056", "Q057", "Q058", "Q059", "Q060", "Q061", "Q062", "Q063", "Q064", "Q065"],

  async run(ctx: AgentContext): Promise<Insight[]> {
    return medicaidEnrollmentInsights(ctx);
  },
};
