/**
 * "What to watch next": a dated list of the coming events that will move
 * the findings on the dashboard. Added after the Phase 7 reviewer test
 * (2026-09-25), which found each finding's next signal buried in its
 * evidence drawer with no dates.
 *
 * Two kinds of entry, never mixed up on the page:
 * - Scheduled: a date that exists in the data itself (a rule's effective
 *   date, a comment deadline) or is fixed (our monthly refresh, the
 *   Marketplace open enrollment start).
 * - Expected: a month estimated from a source's own release history, shown
 *   with "~" and never as a promise. A final payment rule is expected in
 *   the month last year's final followed last year's proposed rule; data
 *   releases follow each source's publication lag.
 */
import type { FederalRegisterDocument } from "../data/adapters/federalRegisterDocuments";
import type { Insight } from "../intelligence/evidence/schema";
import { SOURCE_TIMING } from "../intelligence/evidence/recency";
import { stemOf } from "./findingPresentation";

export interface WatchItem {
  /** ISO date; for an expected item, the first of the expected month. */
  date: string;
  kind: "scheduled" | "expected";
  title: string;
  detail: string;
  /** Live findings this event will update. */
  insightIds: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthStart = (y: number, m: number) => iso(new Date(Date.UTC(y, m - 1, 1)));
function addMonths(date: string, months: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return monthStart(d.getUTCFullYear(), d.getUTCMonth() + 1 + months);
}
const yearOf = (date: string) => Number(date.slice(0, 4));
const monthYear = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const monthsApart = (from: string, to: string) => (yearOf(to) - yearOf(from)) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));

/** Strips the "Medicare Program;" style prefix and trims a Federal Register title for a list. */
export function shortRuleTitle(title: string, max = 90): string {
  const t = title.replace(/^(Medicare|Medicaid|Medicare and Medicaid) Programs?[;:]\s*/i, "");
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** The annual payment rules whose final version is worth a dated watch entry while only the proposal is out. */
const ANNUAL_RULES = [
  { name: "Physician Fee Schedule", pattern: /Payment Policies Under the Physician Fee Schedule/i, stems: ["claims-cost-physician-payment-trend", "policy-proposed-rules"] },
  { name: "Hospital Outpatient (OPPS) and ASC payment", pattern: /Hospital Outpatient Prospective Payment/i, stems: ["policy-proposed-rules"] },
];

export interface WatchInputs {
  insights: Insight[];
  ruleDocuments: FederalRegisterDocument[];
  /** SOURCE_ID -> date the source's content last changed in our snapshots (sourceFingerprints.ts). */
  unchangedSince: Record<string, string>;
  now: Date;
  /** How many items to return, soonest first. */
  limit?: number;
}

export function buildWatchCalendar({ insights, ruleDocuments, unchangedSince, now, limit = 12 }: WatchInputs): WatchItem[] {
  const today = iso(now);
  const byStem = new Map(insights.map((i) => [stemOf(i.id), i]));
  const ids = (...stems: string[]) => stems.map((s) => byStem.get(s)?.id).filter((id): id is string => Boolean(id));
  const latestEnd = (sourceId: string) =>
    insights
      .filter((i) => i.sourceIds.length === 1 && i.sourceIds[0] === sourceId)
      .map((i) => i.period.end)
      .sort()
      .at(-1);
  const items: WatchItem[] = [];
  // An estimate that has already passed means the release is due now, not in the past.
  const expected = (date: string) => (date < monthStart(now.getUTCFullYear(), now.getUTCMonth() + 1) ? monthStart(now.getUTCFullYear(), now.getUTCMonth() + 1) : date);

  items.push({
    date: monthStart(now.getUTCFullYear(), now.getUTCMonth() + 2),
    kind: "scheduled",
    title: "Monthly data refresh",
    detail: "Every source is pulled again; if any data changed, the agents and the executive analyst rerun and this page updates.",
    insightIds: [],
  });

  // Finalized rules taking effect, grouped by date.
  const upcoming = new Map<string, string[]>();
  for (const d of ruleDocuments) {
    if (d.type === "Rule" && d.effectiveOn && d.effectiveOn >= today) upcoming.set(d.effectiveOn, [...(upcoming.get(d.effectiveOn) ?? []), d.title]);
  }
  for (const [date, titles] of [...upcoming].sort(([a], [b]) => a.localeCompare(b)).slice(0, 4)) {
    items.push({
      date,
      kind: "scheduled",
      title: titles.length === 1 ? "A finalized CMS rule takes effect" : `${titles.length} finalized CMS rules take effect`,
      detail: titles.map((t) => shortRuleTitle(t, titles.length > 2 ? 60 : 90)).join("; "),
      insightIds: ids("policy-upcoming-effective"),
    });
  }

  for (const d of ruleDocuments) {
    if (d.type === "Proposed Rule" && d.commentsCloseOn && d.commentsCloseOn >= today) {
      items.push({ date: d.commentsCloseOn, kind: "scheduled", title: "Comment period closes on a proposed CMS rule", detail: shortRuleTitle(d.title), insightIds: ids("policy-proposed-rules") });
    }
  }

  // A final annual payment rule, timed from how long last year's final took after last year's proposal.
  for (const rule of ANNUAL_RULES) {
    const series = ruleDocuments.filter((d) => rule.pattern.test(d.title)).sort((a, b) => a.publicationDate.localeCompare(b.publicationDate));
    const proposals = series.filter((d) => d.type === "Proposed Rule");
    const latestProposal = proposals.at(-1);
    if (!latestProposal || series.some((d) => d.type === "Rule" && d.publicationDate > latestProposal.publicationDate)) continue;
    const priorProposal = proposals.find((d) => yearOf(d.publicationDate) === yearOf(latestProposal.publicationDate) - 1);
    const priorFinal = priorProposal && series.find((d) => d.type === "Rule" && d.publicationDate > priorProposal.publicationDate);
    if (!priorFinal) continue;
    const month = Number(priorFinal.publicationDate.slice(5, 7));
    items.push({
      date: expected(monthStart(yearOf(latestProposal.publicationDate), month)),
      kind: "expected",
      title: `Final ${rule.name} rule`,
      detail: `Proposed ${monthYear(latestProposal.publicationDate)}. Last year's final came out in ${monthYear(priorFinal.publicationDate)}, ${monthsApart(priorProposal.publicationDate, priorFinal.publicationDate)} months after its proposal. It sets next year's payment rates.`,
      insightIds: ids(...rule.stems),
    });
  }

  const ma = latestEnd("cms:ma-part-d-enrollment");
  if (ma) {
    const nextJanuary = monthStart(yearOf(ma) + 1, 1);
    items.push({
      date: nextJanuary,
      kind: "expected",
      title: `January ${yearOf(ma) + 1} Medicare Advantage enrollment report`,
      detail: "The first report after Annual Election Period choices take effect, when most enrollment and market-share movement shows up.",
      insightIds: ids("ma-partd-ma-enrollment-trend", "ma-partd-ma-share-shift", "ma-partd-ma-plan-type-shift"),
    });
  }

  const medicaid = latestEnd("cms:medicaid-state-enrollment");
  if (medicaid) {
    const nextMonth = addMonths(medicaid, 1);
    const [y, m] = nextMonth.split("-").map(Number);
    items.push({
      date: expected(addMonths(nextMonth, SOURCE_TIMING["cms:medicaid-state-enrollment"].publicationLagMonths)),
      kind: "expected",
      title: `${new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${y} Medicaid and CHIP enrollment`,
      detail: "States' next monthly reports, plus final figures replacing the preliminary month shown now.",
      insightIds: ids("medicaid-enrollment-trend", "medicaid-enrollment-by-state"),
    });
  }

  const planYear = latestEnd("cms:marketplace-rate-puf");
  if (planYear) {
    const y = yearOf(planYear);
    items.push({
      date: expected(monthStart(y, 10)),
      kind: "expected",
      title: `Plan year ${y + 1} Marketplace rate and plan files`,
      detail: "Filed premiums, deductibles and issuers for next year, published before open enrollment.",
      insightIds: ids("marketplace-benchmark-trend", "marketplace-deductible-trend", "marketplace-issuer-participation"),
    });
    const oepStart = `${y}-11-01`;
    if (oepStart >= today) {
      items.push({
        date: oepStart,
        kind: "scheduled",
        title: `Marketplace open enrollment for ${y + 1} begins`,
        detail: `CMS's state-level results for it typically follow in spring ${y + 1}.`,
        insightIds: ids("marketplace-enrollment-trend", "marketplace-enrollment-by-state"),
      });
    }
  }

  // Annual CMS files: the next data year arrives a publication lag after it ends.
  const annual = [
    { sourceId: "cms:medicare-physician-by-provider", what: "Medicare physician and practitioner payment data", stems: ["claims-cost-physician-payment-trend", "claims-cost-physician-type-growth", "reimbursement-payment-vs-charge-by-provider-type"] },
    { sourceId: "cms:medicaid-managed-care-plans", what: "Medicaid managed care enrollment by plan", stems: ["medicaid-managed-care-by-state", "medicaid-managed-care-parents"] },
  ];
  for (const { sourceId, what, stems } of annual) {
    const end = latestEnd(sourceId);
    if (!end) continue;
    const nextYear = yearOf(end) + 1;
    items.push({
      date: expected(addMonths(`${nextYear}-12-31`, SOURCE_TIMING[sourceId].publicationLagMonths)),
      kind: "expected",
      title: `${nextYear} ${what}`,
      detail: `CMS publishes each year's file about ${SOURCE_TIMING[sourceId].publicationLagMonths} months after the year ends.`,
      insightIds: ids(...stems),
    });
  }

  const hospitalsChanged = unchangedSince["cms:hospital-general-information"];
  if (hospitalsChanged) {
    items.push({
      date: expected(addMonths(hospitalsChanged, SOURCE_TIMING["cms:hospital-general-information"].updateIntervalMonths)),
      kind: "expected",
      title: "CMS quarterly refresh of hospital data",
      detail: "The first chance to see hospitals open, close or change star rating since this project began pulling.",
      insightIds: ids("provider-network-facility-entries", "provider-network-facility-exits", "provider-network-quality-by-geography-trend"),
    });
  }

  // Hospital penalty factors for the next fiscal year: CMS's FY2027 final-rule page (checked 2026-09-25) says Table 16B comes "in the Fall of 2026" and Table 15 once hospitals have reviewed it.
  const penalties = byStem.get("reimbursement-hospital-penalty-exposure");
  if (penalties) {
    const nextFy = yearOf(penalties.period.end) + 1;
    items.push({
      date: expected(monthStart(nextFy - 1, 11)),
      kind: "expected",
      title: `FY${nextFy} hospital readmissions and value-based purchasing payment factors`,
      detail: `CMS posts each hospital's FY${nextFy} readmissions cut and value-based purchasing adjustment with the inpatient final rule's supplemental tables, expected in fall ${nextFy - 1}.`,
      insightIds: ids("reimbursement-hospital-penalty-exposure", "reimbursement-hospital-penalty-by-state"),
    });
  }
  const feeYear = byStem.get("reimbursement-conversion-factor-trend");
  if (feeYear) {
    const nextYear = yearOf(feeYear.period.end) + 1;
    items.push({
      date: expected(monthStart(nextYear, 1)),
      kind: "expected",
      title: `${nextYear} physician fee schedule rate files`,
      detail: `The first ${nextYear} relative value release, with the conversion factor and service prices in effect January 1.`,
      insightIds: ids("reimbursement-conversion-factor-trend", "reimbursement-procedure-fee-exposure", "reimbursement-fee-change-by-category"),
    });
  }

  // Same date: a scheduled item before an estimate.
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === "scheduled" ? -1 : 1) || a.title.localeCompare(b.title)).slice(0, limit);
}

/** "Oct 1, 2026" for a scheduled date, "~Nov 2026" for an expected month. */
export function formatWatchDate(item: WatchItem): string {
  const d = new Date(`${item.date}T00:00:00Z`);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return item.kind === "expected" ? `~${month} ${d.getUTCFullYear()}` : `${month} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

