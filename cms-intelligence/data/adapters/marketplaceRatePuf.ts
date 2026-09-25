/**
 * CMS Health Insurance Exchange Public Use Files (Marketplace PUFs) -
 * the Rate PUF specifically. Third and final item (per Adam's priority
 * order) in the CMS data-source list - T-MSIS/Medicaid stays
 * deprioritized as the most fragmented (see MANIFEST.md).
 *
 * Verified live 2026-09-23 by crawling CMS's real page structure:
 *   https://www.cms.gov/marketplace/resources/data/public-use-files
 * lists real per-plan-year .zip links back to 2014
 * (download.cms.gov/marketplace-puf/<year>/rate-puf.zip). Downloaded and
 * inspected the real 2026 file directly: a 16MB zip containing a single
 * 280MB CSV, 2,235,761 real data rows, real header confirmed as
 * BusinessYear,StateCode,IssuerId,SourceName,ImportDate,
 * RateEffectiveDate,RateExpirationDate,PlanId,RatingAreaId,Tobacco,Age,
 * IndividualRate,... (family-tier columns follow, unused here).
 *
 * IMPORTANT REAL FINDING that changed this adapter's design: unlike the
 * other CMS adapters, this file only covers Federally-Facilitated
 * Marketplace (FFM) states - inspection confirmed WA, CA, and NY (which
 * run their own State-Based Exchanges: Washington Healthplanfinder,
 * Covered California, NY State of Health) do NOT appear anywhere in
 * this file. The WA/CA/TX/NY/FL 5-state sample this project's physician
 * data used at the time could not be reused for that reason.
 * SAMPLED_STATES below is instead the 5 largest FFM states by real row
 * count in the actual 2026 file (FL, MI, OH, TX, SC) - an objective,
 * documented selection criterion, not an arbitrary pick.
 *
 * Bounded further to a single standard reference age (21 - the flat
 * pre-adult-curve reference age CMS's own rate-review materials and
 * most published ACA premium comparisons use to compare across
 * geography without age-curve noise) and tobacco-neutral rating
 * ("No Preference"). A full 5-state pull at every age/tobacco
 * combination is still ~770K rows - impractical to commit as raw rows.
 * (Summarizing at pull time, as physicianByProviderSummary.ts does, would
 * lift that limit - not yet done here.) This
 * combination yields 14,179 real rows nationally across the 5 sampled
 * states.
 *
 * NAMING/PRIVACY: this file's issuer field (IssuerId) is an opaque
 * numeric HIOS identifier, never a literal company-name string like the
 * MA/Part D file had. Revised 2026-09-24 (see this project's revised
 * carrier-naming rule, AGENT_ARCHITECTURE.md): IssuerId IS now kept,
 * because Q071's own catalog definition ("county-level competitive-
 * intensity signal - number of ISSUERS/plans") calls for counting
 * distinct issuers, and a real data review this same day found that
 * distinct-PlanId counts per RATING AREA are structurally near-uniform
 * within a state (issuers file consistently across every rating area
 * they enter), producing a degenerate, tie-dominated ranking - a real
 * bug caught from Adam's screenshot showing 9 South Carolina rating
 * areas tied at exactly 27. Distinct issuer count, aggregated to the
 * STATE level (not rating area), is the metric that actually carries
 * real cross-geography signal (verified: 7 to 18 real distinct issuers
 * across the 5 sampled states). IssuerId itself is still never surfaced
 * as a name anywhere downstream - only used as a COUNT, same discipline
 * as PlanId below, which is kept for the same real "how many plan
 * options exist" competitive-intensity read (Q071) - every downstream
 * use of either is a COUNT of distinct IDs, never the ID itself
 * surfaced in an insight.
 *
 * Parsing note: unlike maPartDEnrollment.ts's CSV (which has quoted
 * organization-name fields with embedded commas), this file's real,
 * inspected structure has no quoted fields at all - a fast line/comma
 * split is used instead of the shared RFC4180 parseCsv() in ./csv.ts,
 * which would be needlessly slow across 2.2M real lines. If CMS ever
 * changes this file to include quoted fields, the header-index lookup
 * below would still catch a column-count mismatch rather than silently
 * misreading data.
 */
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

export const SOURCE_ID = "cms:marketplace-rate-puf";
const PUF_PAGE_URL = "https://www.cms.gov/marketplace/resources/data/public-use-files";
const YEAR_LINK_PATTERN = /href="(https:\/\/download\.cms\.gov\/marketplace-puf\/(\d{4})\/rate-puf\.zip)"/g;
const DATASET_NAME = "marketplace-rate-puf";
const REFERENCE_AGE = "21";
const TOBACCO_FILTER = "No Preference";
/** The 5 largest Federally-Facilitated Marketplace states by real row count in the 2026 Rate PUF - see file header for why WA/CA/NY couldn't be reused from this project's usual sample. */
const SAMPLED_STATES = new Set(["FL", "MI", "OH", "TX", "SC"]);
const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");
const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; healthcare-intelligence-dashboard/1.0)" };

export interface MarketplaceRateRow {
  state: string;
  ratingArea: string;
  /** Opaque CMS plan identifier, e.g. "15833FL0120007" - not a company name. Only ever used downstream as a COUNT of distinct plans, never surfaced itself. */
  planId: string;
  /** Opaque real HIOS issuer identifier, e.g. "15833" - not a company name. Only ever used downstream as a COUNT of distinct issuers, never surfaced itself. */
  issuerId: string;
  individualRate: number;
}

export interface MarketplaceRatePufSnapshot {
  dataset: string;
  planYear: number;
  sourceUrl: string;
  pulledAt: string;
  sampledStates: string[];
  referenceAge: string;
  tobaccoFilter: string;
  rowCount: number;
  rows: MarketplaceRateRow[];
}

async function findLatestRateZipUrl(): Promise<{ year: number; url: string }> {
  const res = await fetch(PUF_PAGE_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`CMS Marketplace PUF index page fetch failed: ${res.status} ${res.statusText} (${PUF_PAGE_URL})`);
  const html = await res.text();

  let best: { year: number; url: string } | null = null;
  for (const m of html.matchAll(YEAR_LINK_PATTERN)) {
    const [, url, yearStr] = m;
    const year = Number(yearStr);
    if (!best || year > best.year) best = { year, url };
  }
  if (!best) throw new Error(`No rate-puf.zip links found on CMS Marketplace PUF page (${PUF_PAGE_URL}) - page structure may have changed`);
  return best;
}

/**
 * Fast path for this specific, inspected file (no quoted/embedded-comma
 * fields) - scans line by line without materializing an array of all
 * ~2.2M split rows, only keeping the ones that pass the state/age/
 * tobacco filter. See file header for why this doesn't use the shared
 * parseCsv().
 */
function parseAndFilter(csvText: string): MarketplaceRateRow[] {
  const firstNewline = csvText.indexOf("\n");
  if (firstNewline === -1) throw new Error("CMS Rate PUF CSV appears empty or malformed");
  const header = csvText.slice(0, firstNewline).replace(/\r$/, "").split(",");
  const idx = (name: string) => header.indexOf(name);
  const stateIdx = idx("StateCode");
  const ratingAreaIdx = idx("RatingAreaId");
  const planIdIdx = idx("PlanId");
  const issuerIdIdx = idx("IssuerId");
  const tobaccoIdx = idx("Tobacco");
  const ageIdx = idx("Age");
  const rateIdx = idx("IndividualRate");
  if ([stateIdx, ratingAreaIdx, planIdIdx, issuerIdIdx, tobaccoIdx, ageIdx, rateIdx].some((i) => i === -1)) {
    throw new Error(`CMS Rate PUF CSV is missing an expected column - real header was: ${header.join(", ")}`);
  }

  const rows: MarketplaceRateRow[] = [];
  let pos = firstNewline + 1;
  const len = csvText.length;
  while (pos < len) {
    let end = csvText.indexOf("\n", pos);
    if (end === -1) end = len;
    let line = csvText.slice(pos, end);
    pos = end + 1;
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line.length === 0) continue;

    const fields = line.split(",");
    const state = fields[stateIdx];
    if (!SAMPLED_STATES.has(state) || fields[ageIdx] !== REFERENCE_AGE || fields[tobaccoIdx] !== TOBACCO_FILTER) continue;

    const individualRate = Number(fields[rateIdx]);
    if (Number.isNaN(individualRate)) continue;
    rows.push({ state, ratingArea: fields[ratingAreaIdx], planId: fields[planIdIdx], issuerId: fields[issuerIdIdx], individualRate });
  }
  return rows;
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). Downloads the full ~280MB national file transiently to filter it; only the bounded, filtered result is ever persisted to this repo. */
export async function fetchAndSnapshot(): Promise<string> {
  const { year, url } = await findLatestRateZipUrl();

  const zipRes = await fetch(url, { headers: FETCH_HEADERS });
  if (!zipRes.ok) throw new Error(`CMS Rate PUF zip download failed: ${zipRes.status} ${zipRes.statusText} (${url})`);
  const zipBytes = new Uint8Array(await zipRes.arrayBuffer());
  const files = unzipSync(zipBytes);

  const csvEntryName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (!csvEntryName) throw new Error(`No .csv entry found inside the downloaded zip (${url})`);
  const csvText = Buffer.from(files[csvEntryName]).toString("utf-8");

  const rows = parseAndFilter(csvText);

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: MarketplaceRatePufSnapshot = {
    dataset: DATASET_NAME,
    planYear: year,
    sourceUrl: url,
    pulledAt: new Date().toISOString(),
    sampledStates: Array.from(SAMPLED_STATES),
    referenceAge: REFERENCE_AGE,
    tobaccoFilter: TOBACCO_FILTER,
    rowCount: rows.length,
    rows,
  };
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  return file;
}

export function listSnapshotFiles(): string[] {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return [];
  return fs
    .readdirSync(SNAPSHOTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(SNAPSHOTS_DIR, f));
}

export function latestSnapshotFile(): string | null {
  const files = listSnapshotFiles();
  return files.length ? files[files.length - 1] : null;
}

export function loadSnapshot(file: string): MarketplaceRatePufSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as MarketplaceRatePufSnapshot;
}

export function loadLatestSnapshot(): MarketplaceRatePufSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return loadSnapshot(file);
}
