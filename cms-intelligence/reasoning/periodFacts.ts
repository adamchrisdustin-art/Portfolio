/**
 * Code-computed period comparisons handed to the executive analyst
 * alongside the agents' insights (added 2026-09-25). Covers the sources
 * whose snapshots hold every dated record across their 2-year window
 * (Federal Register, openFDA, SEC EDGAR, ClinicalTrials.gov), plus NIH
 * RePORTER's full-population monthly award counts (summarized at pull
 * time since 2026-09-25; before that NIH was a 100-award sample and was
 * left out).
 *
 * The snapshot-level CMS sources (hospitals, home health, MA/Part D
 * enrollment...) aren't here yet: each pull is one point in time, so
 * their comparisons need months of accumulated pulls first.
 */
import fs from "node:fs";
import path from "node:path";
import { comparePeriods, type PeriodComparison } from "../intelligence/trends/periodComparison";
import { SOURCE_ID_BY_DATASET } from "./sourceFingerprints";

export interface MetricPeriodFacts {
  metric: string;
  sourceId: string;
  seasonal: boolean;
  comparisons: PeriodComparison[];
}

const DATA_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence");

type Row = Record<string, unknown>;

interface MetricSpec {
  metric: string;
  dataset: string;
  records: string;
  dateField: string;
  include?: (row: Row) => boolean;
  /** Known annual cycle - see TREND_FRAMEWORK.md's Seasonality section. */
  seasonal: boolean;
}

const METRICS: MetricSpec[] = [
  // CMS's annual payment rules land on a fixed yearly calendar.
  { metric: "CMS final rules published", dataset: "federal-register-documents", records: "documents", dateField: "publicationDate", include: (r) => r.type === "Rule", seasonal: true },
  { metric: "CMS proposed rules published", dataset: "federal-register-documents", records: "documents", dateField: "publicationDate", include: (r) => r.type === "Proposed Rule", seasonal: true },
  { metric: "CMS Federal Register documents published (all types)", dataset: "federal-register-documents", records: "documents", dateField: "publicationDate", seasonal: false },
  { metric: "FDA new molecular entity approvals", dataset: "fda-drug-approvals", records: "approvals", dateField: "submissionStatusDate", include: (r) => r.submissionClassCode === "TYPE 1", seasonal: false },
  // Earnings 8-Ks follow the quarterly reporting calendar.
  { metric: "8-K filings by the 6 tracked health insurers", dataset: "sec-edgar-healthcare-filings", records: "filings", dateField: "filingDate", seasonal: true },
  { metric: "Item 5.02 leadership-change 8-Ks by the 6 tracked health insurers", dataset: "sec-edgar-healthcare-filings", records: "filings", dateField: "filingDate", include: (r) => Array.isArray(r.items) && r.items.includes("5.02"), seasonal: false },
  { metric: "Phase 3 trial results first posted on ClinicalTrials.gov", dataset: "clinicaltrials-phase3-results", records: "trials", dateField: "resultsFirstPostDate", seasonal: false },
];

/** NIH's monthly counts come pre-summarized, not as dated records. Seasonal: awards follow the federal fiscal year, peaking in the months before its September 30 close. */
function nihMonthlyFacts(dataDir: string): MetricPeriodFacts | null {
  const snapshot = latestSnapshot("nih-reporter-awards", dataDir);
  const summary = snapshot?.summary as { byMonth?: { month: string; notices: number }[] } | undefined;
  if (!snapshot || !summary?.byMonth || typeof snapshot.windowStart !== "string" || typeof snapshot.pulledAt !== "string") return null;
  const comparisons = comparePeriods({
    monthlyCounts: Object.fromEntries(summary.byMonth.map((m) => [m.month, m.notices])),
    coverageStart: snapshot.windowStart.slice(0, 10),
    asOf: snapshot.pulledAt.slice(0, 10),
    seasonal: true,
  });
  return comparisons.length === 0
    ? null
    : { metric: "NIH award notices issued (all awards)", sourceId: SOURCE_ID_BY_DATASET["nih-reporter-awards"], seasonal: true, comparisons };
}

function latestSnapshot(dataset: string, dataDir: string): Row | null {
  const dir = path.join(dataDir, dataset, "snapshots");
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.length === 0 ? null : JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf-8"));
}

export function buildPeriodFacts(dataDir: string = DATA_DIR): MetricPeriodFacts[] {
  const facts: MetricPeriodFacts[] = [];
  for (const spec of METRICS) {
    const snapshot = latestSnapshot(spec.dataset, dataDir);
    const rows = snapshot?.[spec.records];
    if (!snapshot || !Array.isArray(rows) || typeof snapshot.windowStart !== "string" || typeof snapshot.pulledAt !== "string") continue;

    const dates = (rows as Row[])
      .filter((r) => !spec.include || spec.include(r))
      .map((r) => r[spec.dateField])
      .filter((d): d is string => typeof d === "string");
    const comparisons = comparePeriods({
      dates,
      coverageStart: snapshot.windowStart.slice(0, 10),
      asOf: snapshot.pulledAt.slice(0, 10),
      seasonal: spec.seasonal,
    });
    if (comparisons.length === 0) continue;
    facts.push({ metric: spec.metric, sourceId: SOURCE_ID_BY_DATASET[spec.dataset] ?? spec.dataset, seasonal: spec.seasonal, comparisons });
  }
  const nih = nihMonthlyFacts(dataDir);
  if (nih) facts.push(nih);
  return facts;
}
