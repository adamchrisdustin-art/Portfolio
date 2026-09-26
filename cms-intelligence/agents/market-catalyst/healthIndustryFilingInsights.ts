/**
 * Health-industry 8-K insights (Q160-Q162) from every company in a health
 * SIC code (data/adapters/secHealthIndustry8k.ts), added 2026-09-25. The
 * 6-insurer watchlist insights (Q120-Q122) keep running beside these;
 * those name each insurer including the ones that filed nothing, these
 * show the whole industry by sector and company.
 *
 * Wording rules, same as the watchlist's: Item 2.01 is "completion of
 * acquisition or disposition of assets" (disposals too, never just
 * "acquisitions"); Item 1.01 covers far more than partnerships; Item 5.02
 * covers appointments as well as departures, never "fired" or
 * "resigned". Filing counts are never tied to enrollment or performance:
 * the first live autonomous run paired 8-K counts with enrollment share
 * with no evidence, and every insight here says a count is disclosure
 * activity only.
 */
import {
  loadLatestSnapshot,
  SECTOR_LABELS,
  sectorOf,
  SOURCE_ID,
  type Health8kSnapshot,
  type SectorId,
} from "../../data/adapters/secHealthIndustry8k";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "market-catalyst-intelligence";
const NATIONAL_GEO = { level: "national" as const, code: "US", label: "United States" };
const TOP_N_COMPANIES = 10;
const RECENT_DEALS_LISTED = 10;

type ItemCode = "1.01" | "2.01" | "5.02";
/** Column of each item in bySicMonth and byCompany rows. */
const SIC_MONTH_COL: Record<ItemCode, 3 | 4 | 5> = { "1.01": 3, "2.01": 4, "5.02": 5 };
const COMPANY_COL: Record<ItemCode, 2 | 3 | 4> = { "1.01": 2, "2.01": 3, "5.02": 4 };

const ITEM_TITLES: Record<ItemCode, string> = {
  "1.01": "entry into a material definitive agreement",
  "2.01": "completion of acquisition or disposition of assets",
  "5.02": "departure or election of directors or principal officers",
};

const ITEM_CAVEATS: Record<ItemCode, string> = {
  "1.01": "Item 1.01 is \"entry into a material definitive agreement\" and covers far more than partnerships (credit facilities, leases, licensing and supply contracts, merger agreements); a filing is never described as a partnership without reading it.",
  "2.01": "Item 2.01 is \"completion of acquisition or disposition of assets\": it reports disposals as well as acquisitions, so a filing is a completed deal of either kind, not necessarily a purchase.",
  "5.02": "Item 5.02 covers appointments as well as departures of directors and principal officers, and routine board changes; a filing is never described as a firing or a resignation without reading it.",
};

function baselineConfidence() {
  return classifyConfidence({ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false });
}

function commonLimitations(snapshot: Health8kSnapshot): string[] {
  return [
    `Covers companies whose SEC industry code (SIC) is one of ${snapshot.sics.length} health codes. Health businesses filed under other codes (conglomerates, research labs, holding companies) are not included, and the code is SEC's classification, not a judgment about the business.`,
    "Counts original 8-Ks only; amendments (8-K/A) restate a report already counted. A filing with several filers counts once, under the first filer with a health code.",
    "A filing count is disclosure activity. It is not evidence of a company's enrollment, revenue or performance, and is never read as one.",
  ];
}

function evidence(snapshot: Health8kSnapshot, id: string, url?: string) {
  const how = snapshot.method === "full-text-search" ? "EDGAR full-text search" : "EDGAR daily form index and submissions API";
  return {
    id,
    sourceId: SOURCE_ID,
    description: `SEC ${how}, every original 8-K filed by companies in ${snapshot.sics.length} health-industry SIC codes, ${snapshot.windowStart} to ${snapshot.windowEnd}`,
    datasetVintage: snapshot.pulledAt.slice(0, 10),
    url,
  };
}

const sectorLabelOf = (sic: string) => {
  const sector = sectorOf(sic);
  return sector ? SECTOR_LABELS[sector] : "Other";
};

const edgarCompanyUrl = (cik: string) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=8-K&dateb=&owner=include&count=40`;

function itemBySector(snapshot: Health8kSnapshot, item: ItemCode): { sector: SectorId; label: string; count: number }[] {
  const totals = new Map<SectorId, number>();
  for (const row of snapshot.bySicMonth) {
    const sector = sectorOf(row[0]);
    if (sector) totals.set(sector, (totals.get(sector) ?? 0) + row[SIC_MONTH_COL[item]]);
  }
  return Array.from(totals, ([sector, count]) => ({ sector, label: SECTOR_LABELS[sector], count })).sort((a, b) => b.count - a.count);
}

/** Monthly counts for whole calendar months strictly inside the window (the first and pull months are partial). */
function monthlySeries(snapshot: Health8kSnapshot, item: ItemCode) {
  const first = snapshot.windowStart.slice(0, 7);
  const last = snapshot.windowEnd.slice(0, 7);
  const byMonth = new Map<string, number>();
  for (const row of snapshot.bySicMonth) {
    if (row[1] <= first || row[1] >= last) continue;
    byMonth.set(row[1], (byMonth.get(row[1]) ?? 0) + row[SIC_MONTH_COL[item]]);
  }
  const points = Array.from(byMonth, ([month, value]) => ({ date: `${month}-01`, value })).sort((a, b) => a.date.localeCompare(b.date));
  return points.length >= 2 ? { label: `Item ${item} 8-Ks by month, health-industry companies`, unit: "filings", points } : undefined;
}

const sectorText = (rows: { label: string; count: number }[]) => rows.map((r) => `${r.label}: ${r.count.toLocaleString()}`).join("; ");

function assetDealsInsight(snapshot: Health8kSnapshot): Insight | null {
  const deals = snapshot.assetDeals;
  if (deals.length === 0) return null;
  const stamp = snapshot.pulledAt.slice(0, 10);
  const sectors = itemBySector(snapshot, "2.01");
  const companies = new Set(deals.map((d) => d[0])).size;
  const nameOf = (cik: string) => snapshot.companies[cik]?.name ?? `CIK ${cik}`;
  const recent = deals.slice(0, RECENT_DEALS_LISTED);
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-sec-health-asset-deals`,
    headline: `Health-industry companies filed ${deals.length.toLocaleString()} 8-Ks reporting a completed acquisition or disposition of assets (Item 2.01) between ${snapshot.windowStart} and ${snapshot.windowEnd}, from ${companies.toLocaleString()} companies; ${sectors[0].label.toLowerCase()} filed the most (${sectors[0].count.toLocaleString()}).`,
    questionId: "Q160",
    signalType: "structural-change",
    period: { start: snapshot.windowStart, end: snapshot.windowEnd },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: deals.length, unit: "filings", comparedTo: `${companies.toLocaleString()} filing companies` },
    drivers: [
      {
        description: `Item 2.01 8-Ks by sector: ${sectorText(sectors)}. Most recent: ${recent.map(([cik, date]) => `${nameOf(cik)} (${date})`).join("; ")}.`,
        supportingEvidenceIds: ["ev-sec-health-asset-deals"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Completed deals across drug makers, device makers, distributors, insurers and providers: consolidation and divestitures that can change who a plan contracts with, what a drug or device costs, and which competitors are growing by acquisition.",
    evidence: [evidence(snapshot, "ev-sec-health-asset-deals", recent[0][2])],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [ITEM_CAVEATS["2.01"], ...commonLimitations(snapshot), "The filing says a deal closed; its size and counterparty are in the filing text, which is not read here."],
    nextSignal: "Watch the monthly count and which sectors lead it on the next pulls; read the linked filings for deal size and counterparty.",
    recommendedInternalValidation: "Open any filing of direct strategic relevance at its linked SEC URL before treating it as an acquisition rather than a disposal.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: monthlySeries(snapshot, "2.01"),
    chart: {
      type: "list",
      title: "Most recent Item 2.01 8-Ks (completed acquisition or disposition of assets), health-industry companies",
      items: recent.map(([cik, date, url]) => ({
        label: nameOf(cik),
        detail: `${date} · ${sectorLabelOf(snapshot.companies[cik]?.sic ?? "")}`,
        url,
      })),
    },
  };
  return validateInsight(insight);
}

async function companyRankingInsight(snapshot: Health8kSnapshot, item: "1.01" | "5.02", questionId: string, idSuffix: string, ctx: AgentContext): Promise<Insight | null> {
  const col = COMPANY_COL[item];
  const filers = snapshot.byCompany.filter((r) => r[col] > 0);
  if (filers.length === 0) return null;
  const stamp = snapshot.pulledAt.slice(0, 10);
  const total = filers.reduce((s, r) => s + r[col], 0);
  const sectors = itemBySector(snapshot, item);
  const info = (cik: string) => snapshot.companies[cik] ?? { name: `CIK ${cik}`, sic: "" };
  const sectorLabel = (cik: string) => sectorLabelOf(info(cik).sic);

  const candidates: Candidate[] = filers.map((r) => ({
    id: r[0],
    label: info(r[0]).name,
    summary: `${r[col]} Item ${item} 8-K${r[col] === 1 ? "" : "s"} of ${r[1]} 8-Ks in the window (${sectorLabel(r[0])})`,
    primaryMetric: r[col],
  }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_COMPANIES, taskDescription: `health-industry companies by Item ${item} 8-K filings (${ITEM_TITLES[item]}) this window` },
    ctx
  );
  if (selections.length === 0) return null;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);

  const max = Math.max(...candidates.map((c) => c.primaryMetric));
  const leaders = candidates.filter((c) => c.primaryMetric === max).sort((a, b) => a.label.localeCompare(b.label));
  const leaderText =
    leaders.length === 1
      ? `${leaders[0].label} filed the most (${max})`
      : `${leaders.length} companies tied for the most (${max} each), among them ${leaders.slice(0, 2).map((l) => l.label).join(" and ")}`;
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-sec-health-${idSuffix}`,
    headline: `Health-industry companies filed ${total.toLocaleString()} 8-Ks reporting ${ITEM_TITLES[item]} (Item ${item}) between ${snapshot.windowStart} and ${snapshot.windowEnd}, from ${filers.length.toLocaleString()} companies; ${leaderText}.`,
    questionId,
    signalType: "structural-change",
    period: { start: snapshot.windowStart, end: snapshot.windowEnd },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: total, unit: "filings", comparedTo: `${filers.length.toLocaleString()} filing companies` },
    drivers: [
      {
        description: `Item ${item} 8-Ks by sector: ${sectorText(sectors)}. By company: ${selected.map(({ selection, candidate }) => `${candidate.label}: ${candidate.summary}${source === "llm" ? ` — ${selection.rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over all ${candidates.length} filing companies` : "deterministic top-N by filing count"}.`,
        supportingEvidenceIds: [`ev-sec-health-${idSuffix}`],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      item === "1.01"
        ? "Material contracts signed across the health industry: licensing and supply deals, credit facilities and merger agreements that often precede a product launch, a financing or an acquisition a plan or provider will feel."
        : "Board and executive changes across the health industry. A cluster at one competitor or supplier is worth reading, because leadership changes often come before shifts in strategy.",
    evidence: [evidence(snapshot, `ev-sec-health-${idSuffix}`, edgarCompanyUrl(leaders[0].id))],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ITEM_CAVEATS[item],
      ...commonLimitations(snapshot),
      "Companies that fund themselves through frequent share sales, loans or board turnover file many of these, and larger companies file more 8-Ks of every kind, so a high count reflects financing and deal volume, not the company's standing.",
    ],
    nextSignal: `Watch which companies and sectors lead Item ${item} filings on the next pulls; read the filings behind any cluster.`,
    recommendedInternalValidation: "Read the actual filing text at SEC before drawing any conclusion beyond \"a filing of this type occurred.\"",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: monthlySeries(snapshot, item),
    chart: {
      type: "bar",
      title: `Health-industry companies with the most Item ${item} 8-Ks, ${snapshot.windowStart} to ${snapshot.windowEnd}`,
      unit: "filings",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };
  return validateInsight(insight);
}

export async function buildHealthIndustryFilingInsights(ctx: AgentContext): Promise<Insight[]> {
  const snapshot = loadLatestSnapshot();
  if (!snapshot || snapshot.byCompany.length === 0) return [];
  const out: Insight[] = [];
  const deals = assetDealsInsight(snapshot);
  if (deals) out.push(deals);
  const agreements = await companyRankingInsight(snapshot, "1.01", "Q161", "material-agreements", ctx);
  if (agreements) out.push(agreements);
  const leadership = await companyRankingInsight(snapshot, "5.02", "Q162", "leadership-changes", ctx);
  if (leadership) out.push(leadership);
  return out;
}
