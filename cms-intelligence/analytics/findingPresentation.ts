/**
 * How a finding card describes itself to an executive: the period its data
 * covers, who it affects, and which other findings to read alongside it.
 * Added after the Phase 7 reviewer test (2026-09-25). Nothing here makes a
 * claim about the data: related findings are "see also" links, never a
 * stated cause, and stakeholders are fixed per finding type.
 */
import type { Insight, Period } from "../intelligence/evidence/schema";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parts = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
};
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * The period a finding's data covers, at the precision its dates carry:
 * whole years ("2013–2024"), months ("Jun 2025–Jun 2026") or days.
 */
export function formatPeriod(period: Period): string {
  const s = parts(period.start);
  const e = parts(period.end);
  const range = (a: string, b: string) => (a === b ? a : `${a}–${b}`);
  if (s.m === 1 && s.d === 1 && e.m === 12 && e.d === 31) return range(String(s.y), String(e.y));
  if (s.d === 1 && (e.d === 1 || e.d === lastDayOfMonth(e.y, e.m))) {
    return range(`${MONTHS[s.m - 1]} ${s.y}`, `${MONTHS[e.m - 1]} ${e.y}`);
  }
  if (s.y === e.y && s.m === e.m) return s.d === e.d ? `${MONTHS[s.m - 1]} ${s.d}, ${s.y}` : `${MONTHS[s.m - 1]} ${s.d}–${e.d}, ${s.y}`;
  return `${MONTHS[s.m - 1]} ${s.d}, ${s.y}–${MONTHS[e.m - 1]} ${e.d}, ${e.y}`;
}

/** A finding's id without its "sig-" prefix and date parts, so it stays the same from one month to the next. */
export function stemOf(id: string): string {
  return id.replace(/^sig-/, "").replace(/-\d{4}(-\d{2}){0,2}(?=-)/g, "");
}

/** Who a finding affects, by agent, with overrides where one agent's findings reach different groups. */
const STAKEHOLDERS_BY_AGENT: Record<string, string[]> = {
  "market-growth-geographic-intelligence": ["Health plans", "Providers"],
  "claims-utilization-cost-intelligence": ["Health plans", "Providers"],
  "reimbursement-payment-intelligence": ["Providers", "Health plans"],
  "provider-network-intelligence": ["Hospitals", "Health plans"],
  "medicare-advantage-part-d-intelligence": ["Medicare Advantage plans", "Providers"],
  "medicaid-chip-dual-eligible-intelligence": ["Medicaid health plans", "States", "Members"],
  "commercial-marketplace-intelligence": ["Exchange insurers", "Members"],
  "policy-regulation-cms-program-intelligence": ["Health plans", "Providers", "States"],
  "emerging-trends-signal-detection": ["Hospitals", "Physicians"],
  "market-catalyst-intelligence": ["Health plans", "Life sciences"],
};

const STAKEHOLDER_OVERRIDES: Record<string, string[]> = {
  "market-growth-hospital-beds-by-state": ["Hospitals", "Health plans"],
  "market-growth-home-health-capacity-signal": ["Home health agencies", "Health plans"],
  "claims-cost-home-health-spending-ratio": ["Home health agencies", "Health plans"],
  "claims-cost-part-b-drug-share": ["Health plans", "Providers", "Drug makers"],
  "ma-partd-part-d-attachment": ["Medicare Advantage plans", "Part D plans", "Drug makers"],
  "ma-partd-plan-type-mix": ["Medicare Advantage plans", "Part D plans"],
  "ma-partd-parent-org-ranking": ["Medicare Advantage plans", "Part D plans"],
  "marketplace-deductible-trend": ["Members", "Exchange insurers"],
  "market-catalyst-nih-award-count": ["Research institutions", "Life sciences"],
  "market-catalyst-nih-total-dollars": ["Research institutions", "Life sciences"],
  "market-catalyst-nih-by-agency": ["Research institutions", "Life sciences"],
  "market-catalyst-nih-research-themes": ["Research institutions", "Life sciences"],
  "market-catalyst-nih-top-orgs": ["Research institutions", "Life sciences"],
  "market-catalyst-fda-nme-count": ["Drug makers", "Health plans"],
  "market-catalyst-fda-priority-split": ["Drug makers", "Health plans"],
  "market-catalyst-fda-by-month": ["Drug makers", "Health plans"],
  "market-catalyst-sec-leadership-change-by-company": ["Health insurers", "Investors"],
  "market-catalyst-sec-filing-mix": ["Health insurers", "Investors"],
  "market-catalyst-sec-material-agreement-by-company": ["Health insurers", "Investors"],
  "market-catalyst-ct-results-count": ["Drug makers", "Health plans"],
  "market-catalyst-ct-enrollment-distribution": ["Drug makers", "Health plans"],
  "market-growth-nursing-home-beds-by-state": ["Nursing homes", "Medicaid health plans", "Medicare Advantage plans"],
  "market-growth-facility-count-by-type": ["Health plans", "Providers"],
  "provider-network-snf-ownership-changes-by-state": ["Nursing homes", "Health plans"],
  "provider-network-private-equity-owners": ["Hospitals", "Nursing homes", "Health plans"],
};

export function stakeholdersFor(insight: Insight): string[] {
  return STAKEHOLDER_OVERRIDES[stemOf(insight.id)] ?? STAKEHOLDERS_BY_AGENT[insight.generatingAgent] ?? [];
}

/**
 * Findings worth reading together. Each group links every member to every
 * other; findingPresentation.test.ts fails if a stem stops matching a live
 * finding, so a renamed insight can't leave a dead link.
 */
export const RELATED_GROUPS: string[][] = [
  ["medicaid-enrollment-trend", "medicaid-enrollment-by-state", "medicaid-managed-care-by-state", "policy-finalized-rules"],
  ["medicaid-managed-care-parents", "ma-partd-parent-org-ranking", "ma-partd-ma-share-shift"],
  ["marketplace-enrollment-trend", "marketplace-enrollment-by-state", "marketplace-net-premium-vs-enrollment", "marketplace-benchmark-trend"],
  ["marketplace-benchmark-trend", "marketplace-benchmark-by-state", "marketplace-deductible-trend", "marketplace-issuer-participation"],
  ["ma-partd-ma-enrollment-trend", "ma-partd-ma-share-shift", "ma-partd-ma-plan-type-shift"],
  ["ma-partd-plan-type-mix", "ma-partd-ma-plan-type-shift", "ma-partd-part-d-attachment"],
  ["claims-cost-physician-payment-trend", "claims-cost-part-b-drug-share", "claims-cost-service-category-growth", "claims-cost-service-code-growth"],
  ["claims-cost-physician-payment-trend", "claims-cost-physician-type-growth", "claims-cost-physician-state-growth", "policy-proposed-rules"],
  ["claims-cost-physician-type-growth", "reimbursement-payment-vs-charge-by-provider-type"],
  ["claims-cost-part-b-drug-share", "market-catalyst-fda-nme-count"],
  ["market-growth-home-health-capacity-signal", "claims-cost-home-health-spending-ratio"],
  ["provider-network-ownership-concentration", "emerging-ownership-concentration-vs-payment-correlation"],
  ["provider-network-quality-correlation", "provider-network-star-rating-by-state", "provider-network-quality-outcome-by-state", "provider-network-quality-by-geography-trend"],
  ["market-growth-hospital-beds-by-state", "provider-network-facility-entries", "provider-network-facility-exits"],
  ["policy-finalized-rules", "policy-upcoming-effective", "policy-proposed-rules"],
  ["market-catalyst-nih-award-count", "market-catalyst-nih-total-dollars", "market-catalyst-nih-by-agency", "market-catalyst-nih-top-orgs"],
  ["market-catalyst-fda-nme-count", "market-catalyst-fda-priority-split", "market-catalyst-fda-by-month"],
  ["market-catalyst-sec-leadership-change-by-company", "market-catalyst-sec-filing-mix", "market-catalyst-sec-material-agreement-by-company"],
  ["market-catalyst-ct-results-count", "market-catalyst-ct-enrollment-distribution"],
  ["market-growth-hospital-beds-by-state", "market-growth-facility-count-by-type", "market-growth-nursing-home-beds-by-state"],
  ["provider-network-hospital-ownership-changes", "provider-network-private-equity-owners", "provider-network-ownership-concentration"],
  ["provider-network-snf-ownership-changes-by-state", "market-growth-nursing-home-beds-by-state", "provider-network-private-equity-owners"],
];

const MAX_RELATED = 4;

/** Up to 4 other live findings to read alongside this one, in group order. */
export function relatedFindings(insight: Insight, all: Insight[]): Insight[] {
  const stem = stemOf(insight.id);
  const byStem = new Map(all.map((i) => [stemOf(i.id), i]));
  const seen = new Set<string>([stem]);
  const related: Insight[] = [];
  for (const group of RELATED_GROUPS) {
    if (!group.includes(stem)) continue;
    for (const other of group) {
      const target = byStem.get(other);
      if (seen.has(other) || !target) continue;
      seen.add(other);
      related.push(target);
    }
  }
  return related.slice(0, MAX_RELATED);
}

/** The first sentence of a headline, for use as a link label. */
export function shortHeadline(headline: string, max = 110): string {
  // A sentence ends at ". X" or "; x"; a semicolon before a capital is inside a rule title ("Medicaid Program; Prohibition").
  const first = headline.split(/(?<=\.)\s(?=[A-Z])|(?<=;)\s(?=[a-z])/)[0].replace(/[.;]$/, "");
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}
