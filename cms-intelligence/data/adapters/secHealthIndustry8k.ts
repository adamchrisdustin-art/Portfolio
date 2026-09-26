/**
 * SEC EDGAR 8-K filings by every company in a health-industry SIC code,
 * added 2026-09-25 to widen the Market Catalyst agent's SEC view beyond
 * the fixed 6-insurer watchlist in secEdgarFilings.ts (which keeps
 * running unchanged). Three 8-K items are tracked: 1.01 (entry into a
 * material definitive agreement), 2.01 (completion of acquisition or
 * disposition of assets) and 5.02 (departure or election of directors or
 * principal officers). The same wording rules apply as for the watchlist:
 * 2.01 covers disposals as well as acquisitions, 1.01 covers far more
 * than partnerships, and 5.02 covers appointments as well as departures.
 *
 * Health SIC codes: checked 2026-09-25 against SEC's own SIC code list
 * (https://www.sec.gov/search-filings/standard-industrial-classification-sic-code-list).
 * 6321 (accident & health insurance) and 8731 (commercial physical &
 * biological research) are left out: both mix in many non-health
 * registrants (disability and supplemental insurers; non-medical labs).
 *
 * PRIMARY PATH - EDGAR full-text search (efts.sec.gov/LATEST/search-index).
 * Verified live 2026-09-25: `forms=8-K&sics=8062&startdt=...&enddt=...`
 * returns one hit per filing (the query filters on `sequence: 1`) whose
 * `_source` carries `ciks`, `display_names`, `sics`, `items`, `form`,
 * `file_date` and `adsh`; 57 hits for SIC 8062 in 2026. Pages are 100
 * hits (`from=` offset) and a query stops counting at 10,000 hits (SIC
 * 2834 alone had 13,259 in the 730-day window), so each SIC is queried in
 * quarter-sized date ranges, halved whenever a range reaches the cap.
 * `forms=8-K` also returns 8-K/A amendments; they are dropped, because an
 * amendment restates an 8-K already counted.
 *
 * Found live 2026-09-25: `sics` is undocumented and the CDN cache in
 * front of the endpoint ignores it (and parameter order, and unknown
 * parameters). A request for SIC 3841 came back with SIC 5912's cached
 * answer. The response echoes the query that actually ran, so every page
 * is checked against the SIC, dates and offset requested; a mismatch is
 * retried once, then the date range is split in two, which changes the
 * cache key. If the check still fails at a single day, or the endpoint
 * errors, the whole pull falls back to the documented path below.
 *
 * FALLBACK - daily form index + submissions API. Every
 * daily-index/YYYY/QTRn/form.YYYYMMDD.idx in the window lists each 8-K's
 * filer CIKs; each distinct CIK's data.sec.gov/submissions JSON gives its
 * SIC code and every filing's items (parsed with secEdgarFilings.ts's
 * recent8KFilings). Complete but slow: several thousand requests, about
 * 20 minutes at SEC's rate limit. The submissions SIC is the company's
 * current one, where full-text search records it per filing.
 *
 * Summarized at pull time: counts by SIC and month and by company, plus
 * every Item 2.01 filing (so the agent can name recent ones with links).
 */
import fs from "node:fs";
import path from "node:path";
import { filingUrl, padCik, recent8KFilings, WINDOW_DAYS, type RawRecentFilings, type RawSubmissionsResponse } from "./secEdgarFilings";
import { secFetch, sleep } from "./secHttp";

export const SOURCE_ID = "sec-edgar:health-industry-8k";
const DATASET_NAME = "sec-edgar-health-industry-8k";
export { WINDOW_DAYS };

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");
const EFTS_URL = "https://efts.sec.gov/LATEST/search-index";
const PAGE_SIZE = 100;
const HIT_CAP = 10_000;
const INITIAL_RANGE_DAYS = 91;

export type SectorId = "pharma-biotech" | "devices" | "distribution-pharmacy" | "insurers" | "providers";

export const SECTOR_LABELS: Record<SectorId, string> = {
  "pharma-biotech": "Pharma & biotech",
  devices: "Medical devices & supplies",
  "distribution-pharmacy": "Drug & supply distribution, pharmacies",
  insurers: "Health insurers",
  providers: "Hospitals & health services",
};

export interface HealthSic {
  code: string;
  label: string;
  sector: SectorId;
}

/** SEC's own SIC titles, checked 2026-09-25 (see file header). */
export const HEALTH_SICS: HealthSic[] = [
  { code: "2833", label: "Medicinal chemicals & botanical products", sector: "pharma-biotech" },
  { code: "2834", label: "Pharmaceutical preparations", sector: "pharma-biotech" },
  { code: "2835", label: "In vitro & in vivo diagnostic substances", sector: "pharma-biotech" },
  { code: "2836", label: "Biological products (no diagnostic substances)", sector: "pharma-biotech" },
  { code: "3841", label: "Surgical & medical instruments & apparatus", sector: "devices" },
  { code: "3842", label: "Orthopedic, prosthetic & surgical appliances & supplies", sector: "devices" },
  { code: "3843", label: "Dental equipment & supplies", sector: "devices" },
  { code: "3844", label: "X-ray apparatus & tubes & related irradiation apparatus", sector: "devices" },
  { code: "3845", label: "Electromedical & electrotherapeutic apparatus", sector: "devices" },
  { code: "3851", label: "Ophthalmic goods", sector: "devices" },
  { code: "5047", label: "Wholesale - medical, dental & hospital equipment & supplies", sector: "distribution-pharmacy" },
  { code: "5122", label: "Wholesale - drugs, proprietaries & druggists' sundries", sector: "distribution-pharmacy" },
  { code: "5912", label: "Retail - drug stores and proprietary stores", sector: "distribution-pharmacy" },
  { code: "6324", label: "Hospital & medical service plans", sector: "insurers" },
  { code: "8000", label: "Services - health services", sector: "providers" },
  { code: "8011", label: "Services - offices & clinics of doctors of medicine", sector: "providers" },
  { code: "8050", label: "Services - nursing & personal care facilities", sector: "providers" },
  { code: "8051", label: "Services - skilled nursing care facilities", sector: "providers" },
  { code: "8060", label: "Services - hospitals", sector: "providers" },
  { code: "8062", label: "Services - general medical & surgical hospitals, NEC", sector: "providers" },
  { code: "8071", label: "Services - medical laboratories", sector: "providers" },
  { code: "8082", label: "Services - home health care services", sector: "providers" },
  { code: "8090", label: "Services - misc health & allied services, NEC", sector: "providers" },
  { code: "8093", label: "Services - specialty outpatient facilities, NEC", sector: "providers" },
];

const HEALTH_SIC_SET = new Set(HEALTH_SICS.map((s) => s.code));
const SECTOR_BY_SIC = new Map(HEALTH_SICS.map((s) => [s.code, s.sector]));

export function sectorOf(sic: string): SectorId | null {
  return SECTOR_BY_SIC.get(sic) ?? null;
}

export const TRACKED_ITEMS = ["1.01", "2.01", "5.02"] as const;

export interface Health8kFiling {
  cik: string; // unpadded
  name: string;
  sic: string;
  filingDate: string;
  items: string[];
  accessionNumber: string;
  url: string;
}

export interface Health8kSnapshot {
  dataset: string;
  pulledAt: string;
  windowStart: string;
  windowEnd: string;
  method: "full-text-search" | "daily-index";
  sics: string[];
  /** Every company with at least one 8-K in the window. */
  companies: Record<string, { name: string; sic: string }>;
  /** [sic, month (YYYY-MM), 8-Ks, with Item 1.01, with Item 2.01, with Item 5.02] */
  bySicMonth: [string, string, number, number, number, number][];
  /** [cik, 8-Ks, with Item 1.01, with Item 2.01, with Item 5.02], most 8-Ks first */
  byCompany: [string, number, number, number, number][];
  /** Every Item 2.01 filing, newest first: [cik, filingDate, url] */
  assetDeals: [string, string, string][];
}

// ---------------------------------------------------------------------------
// Pure helpers (tested)
// ---------------------------------------------------------------------------

const DAY_MS = 864e5;
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/**
 * Consecutive date ranges covering [start, end], about 91 days each. The
 * first range is shortened by `offsetDays` so that each SIC's ranges
 * start on different days, giving every SIC its own cache keys (see file
 * header).
 */
export function dateRanges(start: string, end: string, offsetDays: number): [string, string][] {
  const ranges: [string, string][] = [];
  let from = start;
  let length = INITIAL_RANGE_DAYS - (offsetDays % INITIAL_RANGE_DAYS);
  while (from <= end) {
    const to = addDays(from, length - 1) < end ? addDays(from, length - 1) : end;
    ranges.push([from, to]);
    from = addDays(to, 1);
    length = INITIAL_RANGE_DAYS;
  }
  return ranges;
}

/** "TENET HEALTHCARE CORP  (THC)  (CIK 0000070318)" -> "TENET HEALTHCARE CORP" */
export function companyNameFrom(displayName: string): string {
  return displayName
    .replace(/\s*\(CIK \d+\)\s*$/, "")
    .replace(/\s+\((?:[A-Z0-9.-]+)(?:,\s*[A-Z0-9.-]+)*\)\s*$/, "")
    .trim();
}

interface EftsSource {
  ciks: string[];
  display_names: string[];
  sics?: string[];
  items?: string[];
  form: string;
  file_date: string;
  adsh: string;
}

export interface EftsHit {
  _id: string; // "<accession>:<primary document>"
  _source: EftsSource;
}

interface EftsBody {
  hits: { total: { value: number; relation: string }; hits: EftsHit[] };
  query?: { from?: number; query?: { bool?: { filter?: { terms?: Record<string, unknown>; range?: Record<string, unknown> }[] } } };
}

/**
 * True when the query SEC echoes back is the one requested. The CDN can
 * return another SIC's cached answer (see file header).
 */
export function echoMatches(body: EftsBody, sic: string, start: string, end: string, from: number): boolean {
  const q = body.query;
  if (!q || (q.from ?? 0) !== from) return false;
  const filters = q.query?.bool?.filter ?? [];
  const sics = filters.find((f) => f.terms && "sics" in f.terms)?.terms?.sics;
  const range = filters.find((f) => f.range && "file_date" in f.range)?.range?.file_date as { gte?: string; lte?: string } | undefined;
  return Array.isArray(sics) && sics.length === 1 && sics[0] === sic && range?.gte === start && range?.lte === end;
}

/**
 * One filing from a full-text search hit, or null for an 8-K/A. A filing
 * with several filers is attributed to the first one with a health SIC.
 */
export function hitToFiling(hit: EftsHit, queriedSic: string): Health8kFiling | null {
  const src = hit._source;
  if (src.form !== "8-K") return null;
  const aligned = Array.isArray(src.sics) && src.sics.length === src.ciks.length;
  const idx = aligned ? Math.max(0, src.sics!.findIndex((s) => HEALTH_SIC_SET.has(s))) : 0;
  const cik = String(Number(src.ciks[idx]));
  const primaryDocument = hit._id.split(":")[1] ?? "";
  return {
    cik,
    name: companyNameFrom(src.display_names[idx] ?? ""),
    sic: aligned ? src.sics![idx] : queriedSic,
    filingDate: src.file_date,
    items: src.items ?? [],
    accessionNumber: src.adsh,
    url: filingUrl(cik, src.adsh, primaryDocument),
  };
}

/** 8-K rows of a daily form index: CIK and company name per filer. */
export function parseFormIndex(text: string): { cik: string; name: string }[] {
  const rows: { cik: string; name: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^8-K\s{2,}(.+?)\s{2,}(\d+)\s+\d{8}\s+\S+/.exec(line);
    if (m) rows.push({ name: m[1].trim(), cik: m[2] });
  }
  return rows;
}

const monthOf = (iso: string) => iso.slice(0, 7);

/** The snapshot's summary tables, from every original 8-K in the window. */
export function summarize(
  filings: Health8kFiling[],
  meta: { pulledAt: string; windowStart: string; windowEnd: string; method: Health8kSnapshot["method"] }
): Health8kSnapshot {
  const has = (f: Health8kFiling, item: string) => (f.items.includes(item) ? 1 : 0);
  const companies: Health8kSnapshot["companies"] = {};
  const bySicMonth = new Map<string, [string, string, number, number, number, number]>();
  const byCompany = new Map<string, [string, number, number, number, number]>();
  for (const f of filings) {
    companies[f.cik] = { name: f.name, sic: f.sic };
    const key = `${f.sic}|${monthOf(f.filingDate)}`;
    const sm = bySicMonth.get(key) ?? [f.sic, monthOf(f.filingDate), 0, 0, 0, 0];
    sm[2] += 1;
    sm[3] += has(f, "1.01");
    sm[4] += has(f, "2.01");
    sm[5] += has(f, "5.02");
    bySicMonth.set(key, sm);
    const c = byCompany.get(f.cik) ?? [f.cik, 0, 0, 0, 0];
    c[1] += 1;
    c[2] += has(f, "1.01");
    c[3] += has(f, "2.01");
    c[4] += has(f, "5.02");
    byCompany.set(f.cik, c);
  }
  const assetDeals = filings
    .filter((f) => f.items.includes("2.01"))
    .sort((a, b) => (a.filingDate === b.filingDate ? a.accessionNumber.localeCompare(b.accessionNumber) : a.filingDate < b.filingDate ? 1 : -1))
    .map((f): [string, string, string] => [f.cik, f.filingDate, f.url]);
  return {
    dataset: DATASET_NAME,
    ...meta,
    sics: HEALTH_SICS.map((s) => s.code),
    companies,
    bySicMonth: Array.from(bySicMonth.values()).sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]))),
    byCompany: Array.from(byCompany.values()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    assetDeals,
  };
}

// ---------------------------------------------------------------------------
// Primary path: EDGAR full-text search
// ---------------------------------------------------------------------------

class StaleCacheError extends Error {}

async function searchPage(sic: string, start: string, end: string, from: number): Promise<EftsBody> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const url = `${EFTS_URL}?forms=8-K&sics=${sic}&startdt=${start}&enddt=${end}&from=${from}`;
    const res = await secFetch(url);
    if (!res.ok) throw new Error(`EDGAR full-text search returned ${res.status} (${url})`);
    const body = (await res.json()) as EftsBody;
    if (echoMatches(body, sic, start, end, from)) return body;
    await sleep(1000);
  }
  throw new StaleCacheError(`cached answer for another query: SIC ${sic}, ${start} to ${end}, from ${from}`);
}

async function searchRange(sic: string, start: string, end: string, out: Map<string, Health8kFiling>, log: (msg: string) => void): Promise<void> {
  const split = async () => {
    const mid = addDays(start, Math.floor(daysBetween(start, end) / 2));
    await searchRange(sic, start, mid, out, log);
    await searchRange(sic, addDays(mid, 1), end, out, log);
  };
  try {
    const first = await searchPage(sic, start, end, 0);
    const { value: total, relation } = first.hits.total;
    if (relation !== "eq" || total >= HIT_CAP) {
      if (start === end) throw new Error(`SIC ${sic} has 10,000 or more 8-Ks on ${start}; the search can't page past that`);
      await split();
      return;
    }
    const collect = (hits: EftsHit[]) => {
      for (const hit of hits) {
        const filing = hitToFiling(hit, sic);
        if (filing && !out.has(filing.accessionNumber)) out.set(filing.accessionNumber, filing);
      }
    };
    collect(first.hits.hits);
    for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) collect((await searchPage(sic, start, end, from)).hits.hits);
  } catch (err) {
    if (!(err instanceof StaleCacheError) || start === end) throw err;
    log(`[health-8k] ${err.message}; splitting the range`);
    await split();
  }
}

async function collectViaFullTextSearch(windowStart: string, windowEnd: string, log: (msg: string) => void): Promise<Health8kFiling[]> {
  const out = new Map<string, Health8kFiling>();
  for (const [i, { code }] of HEALTH_SICS.entries()) {
    const before = out.size;
    for (const [start, end] of dateRanges(windowStart, windowEnd, i)) await searchRange(code, start, end, out, log);
    log(`[health-8k] SIC ${code}: ${out.size - before} 8-Ks`);
  }
  return Array.from(out.values());
}

// ---------------------------------------------------------------------------
// Fallback: daily form index + submissions API
// ---------------------------------------------------------------------------

function quartersBetween(start: string, end: string): { year: number; qtr: number }[] {
  const out: { year: number; qtr: number }[] = [];
  let year = Number(start.slice(0, 4));
  let qtr = Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1;
  const endKey = Number(end.slice(0, 4)) * 10 + Math.floor((Number(end.slice(5, 7)) - 1) / 3) + 1;
  while (year * 10 + qtr <= endKey) {
    out.push({ year, qtr });
    if (++qtr > 4) {
      qtr = 1;
      year++;
    }
  }
  return out;
}

async function collectViaDailyIndex(windowStart: string, windowEnd: string, log: (msg: string) => void): Promise<Health8kFiling[]> {
  const filers = new Map<string, string>();
  const startKey = windowStart.replace(/-/g, "");
  const endKey = windowEnd.replace(/-/g, "");
  for (const { year, qtr } of quartersBetween(windowStart, windowEnd)) {
    const base = `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${qtr}/`;
    const listing = await secFetch(`${base}index.json`);
    if (!listing.ok) continue;
    const items = ((await listing.json()) as { directory: { item: { name: string }[] } }).directory.item;
    for (const { name } of items) {
      const day = /^form\.(\d{8})\.idx$/.exec(name)?.[1];
      if (!day || day < startKey || day > endKey) continue;
      const res = await secFetch(`${base}${name}`, "text/plain");
      if (!res.ok) continue;
      for (const row of parseFormIndex(await res.text())) filers.set(row.cik, row.name);
    }
  }
  log(`[health-8k] daily index: ${filers.size} distinct 8-K filers; reading each one's submissions`);

  const out = new Map<string, Health8kFiling>();
  for (const [cik, indexName] of filers) {
    const res = await secFetch(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`);
    if (!res.ok) continue;
    const body = (await res.json()) as RawSubmissionsResponse;
    const sic = body.sic ?? "";
    if (!HEALTH_SIC_SET.has(sic)) continue;
    const name = body.name ?? indexName;
    const blocks: RawRecentFilings[] = [body.filings.recent];
    const oldestRecent = body.filings.recent.filingDate.at(-1);
    if (oldestRecent && oldestRecent > windowStart) {
      for (const file of body.filings.files ?? []) {
        if (file.filingTo < windowStart) continue;
        const older = await secFetch(`https://data.sec.gov/submissions/${file.name}`);
        if (older.ok) blocks.push((await older.json()) as RawRecentFilings);
      }
    }
    for (const block of blocks) {
      for (const f of recent8KFilings(block, cik, name, windowStart)) {
        if (f.filingDate > windowEnd || out.has(f.accessionNumber)) continue;
        out.set(f.accessionNumber, { cik, name, sic, filingDate: f.filingDate, items: f.items, accessionNumber: f.accessionNumber, url: f.url });
      }
    }
  }
  return Array.from(out.values());
}

// ---------------------------------------------------------------------------
// Pull + snapshot
// ---------------------------------------------------------------------------

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const pulledAt = new Date().toISOString();
  const windowEnd = pulledAt.slice(0, 10);
  const windowStart = addDays(windowEnd, -WINDOW_DAYS);
  let filings: Health8kFiling[];
  let method: Health8kSnapshot["method"] = "full-text-search";
  try {
    filings = await collectViaFullTextSearch(windowStart, windowEnd, log);
    if (filings.length === 0) throw new Error("no filings returned");
  } catch (err) {
    log(`[health-8k] full-text search failed (${err instanceof Error ? err.message : err}); falling back to the daily form index`);
    method = "daily-index";
    filings = await collectViaDailyIndex(windowStart, windowEnd, log);
  }
  const snapshot = summarize(filings, { pulledAt, windowStart, windowEnd, method });
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${windowEnd}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot));
  log(`[health-8k] ${filings.length} 8-Ks from ${Object.keys(snapshot.companies).length} companies via ${method}`);
  return file;
}

export function latestSnapshotFile(): string | null {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return null;
  const files = fs.readdirSync(SNAPSHOTS_DIR).filter((f) => f.endsWith(".json")).sort();
  return files.length ? path.join(SNAPSHOTS_DIR, files[files.length - 1]) : null;
}

/** Returns null (never throws) when no snapshot exists yet - callers must treat that as "no data available." */
export function loadLatestSnapshot(): Health8kSnapshot | null {
  const file = latestSnapshotFile();
  return file ? (JSON.parse(fs.readFileSync(file, "utf-8")) as Health8kSnapshot) : null;
}
