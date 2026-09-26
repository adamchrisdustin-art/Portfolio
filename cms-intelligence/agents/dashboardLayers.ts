/**
 * Question ID -> dashboard layer mapping. The master orchestrator names
 * 7 layers, but doesn't give MA/Part D, Medicaid/Duals, or Marketplace
 * (Q046-Q072) their own layer - Phase 2's DASHBOARD_BLUEPRINT.md
 * inherited that gap (Layer 2 "Market & Growth" only listed Q001-Q010).
 * Fixed here during Phase 5 implementation: those enrollment/market-
 * structure questions fold into Layer 2, consistent with that layer's
 * own stated content ("enrollment... market composition... CMS program
 * participation") - see DASHBOARD_BLUEPRINT.md's note on this.
 */
import { questionNumberFrom } from "./routing";

export type DashboardLayer =
  | "executive-pulse"
  | "market-growth"
  | "claims-cost"
  | "reimbursement-provider-economics"
  | "provider-network"
  | "policy-program-watch"
  | "emerging-signals"
  | "market-catalysts";

export const LAYER_LABELS: Record<DashboardLayer, string> = {
  "executive-pulse": "Executive Pulse",
  "market-growth": "Market & Growth",
  "claims-cost": "Claims & Cost",
  "reimbursement-provider-economics": "Reimbursement & Provider Economics",
  "provider-network": "Provider & Network",
  "policy-program-watch": "Policy & Program Watch",
  "emerging-signals": "Emerging Signals",
  "market-catalysts": "Market Catalysts",
};

interface LayerRange {
  from: number;
  to: number;
  layer: DashboardLayer;
}

const LAYER_RANGES: LayerRange[] = [
  { from: 1, to: 10, layer: "market-growth" },
  { from: 11, to: 25, layer: "claims-cost" },
  { from: 26, to: 35, layer: "reimbursement-provider-economics" },
  { from: 36, to: 45, layer: "provider-network" },
  { from: 46, to: 72, layer: "market-growth" }, // MA/Part D, Medicaid/Duals, Marketplace - the fix, see file header
  { from: 73, to: 84, layer: "policy-program-watch" },
  { from: 85, to: 95, layer: "emerging-signals" },
  { from: 96, to: 101, layer: "claims-cost" }, // pharmacy/Part D economics
  { from: 102, to: 107, layer: "provider-network" }, // value-based care
  { from: 108, to: 112, layer: "executive-pulse" },
  { from: 113, to: 124, layer: "market-catalysts" }, // Market/Catalyst Intelligence - its own layer since the 2026-09-25 reviewer test, so Emerging Signals holds only cross-domain findings
  { from: 125, to: 128, layer: "provider-network" }, // hospital star rating vs. quality outcomes - same layer as Q036-045/Q102-107
  { from: 129, to: 129, layer: "market-catalysts" }, // NIH research-theme frequency - same layer as the rest of Market/Catalyst Intelligence
];

export function layerForQuestion(questionId: string): DashboardLayer {
  const n = questionNumberFrom(questionId);
  const range = LAYER_RANGES.find((r) => n >= r.from && n <= r.to);
  return range?.layer ?? "executive-pulse";
}

export const ALL_LAYERS: DashboardLayer[] = [
  "executive-pulse",
  "market-growth",
  "claims-cost",
  "reimbursement-provider-economics",
  "provider-network",
  "policy-program-watch",
  "emerging-signals",
  "market-catalysts",
];
