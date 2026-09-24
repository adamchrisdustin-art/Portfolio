/**
 * Static question-ID -> owning-agent-ID routing table, derived from the
 * category ranges in docs/cms-intelligence/EXECUTIVE_QUESTION_CATALOG.md
 * and the ownership stated in AGENT_ARCHITECTURE.md. Where a question is
 * jointly owned (e.g. Q096-Q101 pharmacy questions), this table routes to
 * the primary owner only - the joint owner is documented in
 * AGENT_ARCHITECTURE.md's prose, not encoded twice here.
 *
 * Q108-Q112 (Executive Strategy) and the two infrastructure agents
 * (source-change-monitor, data-architecture-semantic-model) intentionally
 * have no entries - they aren't routed to as specialists.
 *
 * Q113-Q124 (Market/Catalyst Intelligence) added 2026-09-24 - a new
 * category beyond the original 112-question catalog, owned outright by
 * the 12th agent (no joint ownership).
 *
 * Q125-Q128 (hospital star rating vs. quality outcomes) added 2026-09-24,
 * owned by Provider & Network - a thematic extension of that agent's
 * existing Q036-Q045 range rather than a new numeric range next to it,
 * since both read the same Hospital General Information dataset.
 *
 * Q129 (NIH research-theme frequency) added 2026-09-24, owned by
 * Market/Catalyst Intelligence - a one-question extension of that
 * agent's own Q113-Q124 range, given as its own entry below only because
 * Q125-Q128 sits numerically in between (owned by a different agent).
 */
export interface QuestionRange {
  from: number;
  to: number;
  agentId: string;
}

export const QUESTION_ROUTING: QuestionRange[] = [
  { from: 1, to: 10, agentId: "market-growth-geographic-intelligence" },
  { from: 11, to: 25, agentId: "claims-utilization-cost-intelligence" },
  { from: 26, to: 35, agentId: "reimbursement-payment-intelligence" },
  { from: 36, to: 45, agentId: "provider-network-intelligence" },
  { from: 46, to: 55, agentId: "medicare-advantage-part-d-intelligence" },
  { from: 56, to: 65, agentId: "medicaid-chip-dual-eligible-intelligence" },
  { from: 66, to: 72, agentId: "commercial-marketplace-intelligence" },
  { from: 73, to: 84, agentId: "policy-regulation-cms-program-intelligence" },
  { from: 85, to: 95, agentId: "emerging-trends-signal-detection" },
  { from: 96, to: 101, agentId: "medicare-advantage-part-d-intelligence" }, // pharmacy/Part D, jointly owned - see AGENT_ARCHITECTURE.md
  { from: 102, to: 107, agentId: "provider-network-intelligence" }, // value-based care, jointly owned - see AGENT_ARCHITECTURE.md
  { from: 113, to: 124, agentId: "market-catalyst-intelligence" },
  { from: 125, to: 128, agentId: "provider-network-intelligence" },
  { from: 129, to: 129, agentId: "market-catalyst-intelligence" },
];

export function questionNumberFrom(questionId: string): number {
  const match = /^Q(\d+)$/.exec(questionId);
  if (!match) throw new Error(`Malformed question ID: ${questionId}`);
  return Number(match[1]);
}

/** Returns the owning agent ID for a question, or null for orchestrator-only questions (Q108-Q112) or an unrecognized ID. */
export function routeQuestion(questionId: string): string | null {
  const n = questionNumberFrom(questionId);
  const range = QUESTION_ROUTING.find((r) => n >= r.from && n <= r.to);
  return range?.agentId ?? null;
}

/** Returns the distinct set of agent IDs that own at least one of the given questions. */
export function routeQuestions(questionIds: string[]): string[] {
  const agentIds = new Set<string>();
  for (const q of questionIds) {
    const agentId = routeQuestion(q);
    if (agentId) agentIds.add(agentId);
  }
  return Array.from(agentIds);
}
