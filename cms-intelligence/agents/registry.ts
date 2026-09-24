/**
 * All 11 specialist agents (everything except the Executive Orchestrator
 * itself, which isn't a routable specialist - see routing.ts). The
 * orchestrator imports this list rather than importing each agent
 * individually, so adding a 13th agent later is a one-line change here,
 * not a change to orchestrator.ts.
 */
import { claimsUtilizationCostAgent } from "./claims-utilization-cost/agent";
import { commercialMarketplaceAgent } from "./commercial-marketplace/agent";
import { dataArchitectureAgent } from "./data-architecture/agent";
import { emergingTrendsAgent } from "./emerging-trends/agent";
import { marketGrowthAgent } from "./market-growth/agent";
import { medicaidChipDualEligibleAgent } from "./medicaid-chip-dual-eligible/agent";
import { medicareAdvantagePartDAgent } from "./medicare-advantage-part-d/agent";
import { policyRegulationCmsAgent } from "./policy-regulation-cms/agent";
import { providerNetworkAgent } from "./provider-network/agent";
import { reimbursementPaymentAgent } from "./reimbursement-payment/agent";
import { sourceChangeMonitorAgent } from "./source-change-monitor/agent";
import type { DomainAgent } from "./types";

export const ALL_AGENTS: DomainAgent[] = [
  marketGrowthAgent,
  claimsUtilizationCostAgent,
  reimbursementPaymentAgent,
  providerNetworkAgent,
  medicareAdvantagePartDAgent,
  medicaidChipDualEligibleAgent,
  commercialMarketplaceAgent,
  policyRegulationCmsAgent,
  emergingTrendsAgent,
  sourceChangeMonitorAgent,
  dataArchitectureAgent,
];

export function getAgentById(id: string): DomainAgent | undefined {
  return ALL_AGENTS.find((a) => a.id === id);
}
