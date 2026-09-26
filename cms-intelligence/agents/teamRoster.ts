/**
 * "Meet the team" copy for the dashboard. Titles read as org-chart job titles;
 * each role is a one-sentence plain-language paraphrase of that agent's Mission in
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md, scoped to what the agent actually does
 * today. Agent ids must match ALL_AGENTS (enforced by teamRoster.test.ts).
 */
export interface TeamMember {
  agentId: string;
  title: string;
  domain: string;
  role: string;
  status?: "infrastructure" | "deliberate stub";
}

export const ORCHESTRATOR: TeamMember = {
  agentId: "executive-orchestrator",
  title: "Chief Intelligence Officer",
  domain: "Executive Orchestrator",
  role: "Runs every specialist each cycle, reconciles what they report, and turns it into a single briefing for leadership.",
};

export const SPECIALISTS: TeamMember[] = [
  {
    agentId: "market-growth-geographic-intelligence",
    title: "Market Research Specialist",
    domain: "Market Growth & Geography",
    role: "Maps where healthcare capacity and demand are concentrated, and where they are growing, across states.",
  },
  {
    agentId: "claims-utilization-cost-intelligence",
    title: "Healthcare Cost Analyst",
    domain: "Claims, Utilization & Cost",
    role: "Breaks Medicare spending growth into more care versus costlier care, down to specialties, service categories and individual codes.",
  },
  {
    agentId: "reimbursement-payment-intelligence",
    title: "Reimbursement Strategy Manager",
    domain: "Reimbursement & Payment",
    role: "Benchmarks what Medicare actually pays against what providers bill, by provider type.",
  },
  {
    agentId: "provider-network-intelligence",
    title: "Provider Network Analyst",
    domain: "Provider & Network",
    role: "Tracks the hospital supply side: ownership concentration, facility entries and exits, and whether star ratings match real quality outcomes.",
  },
  {
    agentId: "medicare-advantage-part-d-intelligence",
    title: "Medicare Advantage Market Analyst",
    domain: "Medicare Advantage & Part D",
    role: "Follows Medicare Advantage and Part D enrollment, market share by parent organization, and the shift between plan types.",
  },
  {
    agentId: "medicaid-chip-dual-eligible-intelligence",
    title: "Medicaid Program Analyst",
    domain: "Medicaid, CHIP & Duals",
    role: "Tracks Medicaid and CHIP enrollment by state from the states' monthly reports, labeling each state's report month and status, and which health plan companies hold Medicaid managed care membership.",
  },
  {
    agentId: "commercial-marketplace-intelligence",
    title: "Marketplace Pricing Analyst",
    domain: "ACA Marketplace",
    role: "Watches ACA Marketplace premiums, deductibles and insurer entries and exits across HealthCare.gov states.",
  },
  {
    agentId: "policy-regulation-cms-program-intelligence",
    title: "Regulatory Affairs Specialist",
    domain: "Policy & Regulation",
    role: "Separates CMS rules that are final and binding from ones still only proposed, and flags what takes effect soon.",
  },
  {
    agentId: "emerging-trends-signal-detection",
    title: "Strategic Insights Analyst",
    domain: "Emerging Trends",
    role: "Looks across the other specialists' data for patterns no single dataset shows on its own.",
  },
  {
    agentId: "market-catalyst-intelligence",
    title: "Competitive Intelligence Analyst",
    domain: "Market Catalysts",
    role: "Logs dated market events: health-industry SEC filings and private funding notices, FDA new-drug approvals, NIH research awards and Phase 3 trial results.",
  },
  {
    agentId: "data-source-cms-change-monitor",
    title: "Data Quality Engineer",
    domain: "Data Source Monitoring",
    role: "Checks every source for new, late or changed data so the rest of the team never reports on stale numbers.",
    status: "infrastructure",
  },
  {
    agentId: "data-architecture-semantic-model",
    title: "Data Architect",
    domain: "Semantic Model",
    role: "Keeps shared definitions of populations, geographies and entities consistent, so findings from different datasets stay comparable.",
    status: "infrastructure",
  },
];
