/**
 * CMS facility ownership files - hospital and skilled nursing facility
 * (SNF) changes of ownership, the owners on file for each buyer, and which
 * facilities report a private equity owner. Added 2026-09-25 for the
 * Provider & Network agent's facility M&A read. Owner and buyer names are
 * public Medicare enrollment records and are only ever shown as sourced
 * findings.
 *
 * Verified live 2026-09-25 (data.cms.gov/data.json, data API):
 * - "Hospital Change of Ownership" and "Skilled Nursing Facility Change of
 *   Ownership": quarterly, each version cumulative (every change effective
 *   2016 onward; 772 hospital and 5,227 SNF rows in the 2026-06 version),
 *   so only the latest version is needed. One row per change: buyer and
 *   seller enrollment ID, CCN, organization name, state, CHOW TYPE TEXT
 *   (CHANGE OF OWNERSHIP, ACQUISITION/MERGER, CONSOLIDATION), EFFECTIVE DATE.
 * - "... Change of Ownership - Owner Information": the owners, officers and
 *   managers on file for every buyer and seller enrollment (every hospital
 *   buyer matched). Only 5%-or-greater direct and indirect organization
 *   owners are kept, to name the parent behind an SNF buyer, which is
 *   usually a single-facility LLC.
 * - "Hospital All Owners" and "Skilled Nursing Facility All Owners":
 *   monthly, every owner of every enrolled facility. The "PRIVATE EQUITY
 *   COMPANY - OWNER" flag exists from 2025-04 (hospitals) and 2024-11
 *   (SNFs) only; earlier versions don't have the column, and the API
 *   silently ignores a filter on a missing column (it returned all 120,305
 *   rows of the 2022-11 hospital file), so each version's columns are
 *   checked before it's filtered, and months without the flag are skipped
 *   rather than compared.
 *
 * Storage: the change-of-ownership snapshot is written only when its
 * content changes (a new dated file under snapshots/). Private equity
 * months go one file per month under months/ (a past month never
 * changes), plus a dated manifest of content hashes under snapshots/ for
 * the reasoning change gate. No API key, no auth.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const CHOW_SOURCE_ID = "cms:facility-change-of-ownership";
export const CHOW_DATASET_NAME = "facility-change-of-ownership";
export const PE_SOURCE_ID = "cms:facility-all-owners";
export const PE_DATASET_NAME = "facility-private-equity-owners";

const CATALOG_URL = "https://data.cms.gov/data.json";
const API_BASE = "https://data.cms.gov/data-api/v1/dataset";
const PAGE_SIZE = 5000;
const PE_COLUMN = "PRIVATE EQUITY COMPANY - OWNER";
/** Buyer parents are looked up for changes effective in this many years before the newest one. */
const OWNER_LOOKBACK_YEARS = 5;
/** 5% or greater direct / indirect ownership interest. */
const OWNERSHIP_ROLE_CODES = new Set(["34", "35"]);

export type FacilityKind = "hospital" | "snf";

export const CATALOG_TITLES = {
  hospital: {
    chow: "Hospital Change of Ownership",
    chowOwners: "Hospital Change of Ownership - Owner Information",
    allOwners: "Hospital All Owners",
  },
  snf: {
    chow: "Skilled Nursing Facility Change of Ownership",
    chowOwners: "Skilled Nursing Facility Change of Ownership - Owner Information",
    allOwners: "Skilled Nursing Facility All Owners",
  },
} as const;

const CHOW_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", CHOW_DATASET_NAME);
const PE_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", PE_DATASET_NAME);

type RawRow = Record<string, string | undefined>;

export interface OwnershipChange {
  kind: FacilityKind;
  effectiveDate: string;
  /** CHOW TYPE TEXT as CMS writes it. */
  chowType: string;
  state: string;
  ccn: string;
  /** Buyer's provider type text, e.g. "PART A PROVIDER - CRITICAL ACCESS HOSPITAL". */
  providerType: string;
  buyerEnrollmentId: string;
  buyerName: string;
  sellerName: string;
}

export interface ChowSnapshot {
  dataset: string;
  pulledAt: string;
  /** Period of the latest CMS version, e.g. { start: "2026-04-01", end: "2026-06-30" }. */
  versions: Record<FacilityKind, { periodStart: string; periodEnd: string; datasetId: string; rowCount: number }>;
  /** Every hospital change; SNF changes effective in the lookback window (OWNER_LOOKBACK_YEARS) only. */
  changes: OwnershipChange[];
  /** Buyer enrollment ID -> 5%+ organization owners on file (changes in the lookback window only). */
  buyerOwners: Record<string, string[]>;
  /**
   * Changes counted by effective year as each past CMS version reported
   * them, keyed "hospital|2025-Q2" -> { "2024": 91, ... }. A year keeps
   * filling in for 12-18 months after it ends (SNF changes effective in
   * 2024: 69 in the 2024-Q2 version, 420 in 2025-Q2, 741 in 2026-Q2), so
   * years are only compared at the same reporting lag.
   */
  vintages: Record<string, Record<string, number>>;
}

/** Counts by effective year, as one version reported them. */
export function countByYear(rows: Iterable<RawRow>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const year = clean(r["EFFECTIVE DATE"]).slice(0, 4);
    if (/^\d{4}$/.test(year)) out[year] = (out[year] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort());
}

export function quarterOfPeriod(periodStart: string): string {
  return `${periodStart.slice(0, 4)}-Q${Math.floor((Number(periodStart.slice(5, 7)) - 1) / 3) + 1}`;
}

/**
 * Changes effective in the newest complete year, against the year before
 * as CMS reported it at the same point one year earlier. Null when the
 * version a year back isn't on file.
 */
export function sameLagComparison(snapshot: ChowSnapshot, kind: FacilityKind): { version: string; priorVersion: string; year: number; count: number; priorYear: number; priorCount: number } | null {
  const version = quarterOfPeriod(snapshot.versions[kind].periodStart);
  const [y, q] = version.split("-Q");
  const priorVersion = `${Number(y) - 1}-Q${q}`;
  const now = snapshot.vintages[`${kind}|${version}`];
  const then = snapshot.vintages[`${kind}|${priorVersion}`];
  const year = Number(y) - 1;
  if (!now || !then || now[String(year)] === undefined || then[String(year - 1)] === undefined) return null;
  return { version, priorVersion, year, count: now[String(year)], priorYear: year - 1, priorCount: then[String(year - 1)] };
}

export interface PrivateEquityMonth {
  dataset: string;
  kind: FacilityKind;
  /** e.g. "2026-08" */
  month: string;
  datasetId: string;
  /** Every owner row flagged private equity: [facility enrollment ID, facility organization name, owner organization name, association date]. */
  rows: [string, string, string, string][];
}

export interface PeManifest {
  dataset: string;
  pulledAt: string;
  files: Record<string, string>;
}

const clean = (v: string | undefined) => (v ?? "").trim();

export function toOwnershipChange(raw: RawRow, kind: FacilityKind): OwnershipChange | null {
  const effectiveDate = clean(raw["EFFECTIVE DATE"]);
  const state = clean(raw["ENROLLMENT STATE - BUYER"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !/^[A-Z]{2}$/.test(state)) return null;
  return {
    kind,
    effectiveDate,
    chowType: clean(raw["CHOW TYPE TEXT"]),
    state,
    ccn: clean(raw["CCN - BUYER"]),
    providerType: clean(raw["PROVIDER TYPE TEXT - BUYER"]),
    buyerEnrollmentId: clean(raw["ENROLLMENT ID - BUYER"]),
    buyerName: clean(raw["ORGANIZATION NAME - BUYER"]),
    sellerName: clean(raw["ORGANIZATION NAME - SELLER"]),
  };
}

/** 5%+ organization owners per buyer enrollment, for the buyers given. */
export function buyerOwnersFrom(rows: Iterable<RawRow>, buyers: Set<string>): Record<string, string[]> {
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    const id = clean(r["ENROLLMENT ID"]);
    const name = clean(r["ORGANIZATION NAME - OWNER"]);
    if (!buyers.has(id) || clean(r["TYPE - OWNER"]) !== "O" || !OWNERSHIP_ROLE_CODES.has(clean(r["ROLE CODE - OWNER"])) || !name) continue;
    if (!out.has(id)) out.set(id, new Set());
    out.get(id)!.add(name);
  }
  return Object.fromEntries([...out].sort((a, b) => a[0].localeCompare(b[0])).map(([id, names]) => [id, [...names].sort()]));
}

export function privateEquityRows(rows: Iterable<RawRow>): [string, string, string, string][] {
  const out: [string, string, string, string][] = [];
  for (const r of rows) {
    if (clean(r[PE_COLUMN]) !== "Y") continue;
    out.push([clean(r["ENROLLMENT ID"]), clean(r["ORGANIZATION NAME"]), clean(r["ORGANIZATION NAME - OWNER"]), clean(r["ASSOCIATION DATE - OWNER"])]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]));
}

// ---------------------------------------------------------------------------
// Live pull
// ---------------------------------------------------------------------------

interface VersionRef {
  periodStart: string;
  periodEnd: string;
  datasetId: string;
}

type Catalog = { dataset: { title: string; distribution?: { accessURL?: string; temporal?: string }[] }[] };

async function fetchCatalog(): Promise<Catalog> {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`CMS catalog fetch failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as Catalog;
}

/** Every version of a catalog title, newest first (each is listed twice, API and a mirror; the first listed is the primary). */
export function versionsOf(catalog: Catalog, title: string): VersionRef[] {
  const entry = catalog.dataset.find((d) => d.title === title);
  if (!entry) throw new Error(`"${title}" not found in the CMS catalog`);
  const seen = new Set<string>();
  const out: VersionRef[] = [];
  for (const dist of entry.distribution ?? []) {
    const match = dist.accessURL?.match(/data-api\/v1\/dataset\/([0-9a-f-]+)\/data/);
    const [start, end] = (dist.temporal ?? "").split("/");
    if (!match || !start || !end || seen.has(start)) continue;
    seen.add(start);
    out.push({ periodStart: start, periodEnd: end, datasetId: match[1] });
  }
  return out.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt >= 6) throw new Error(`CMS data-api request failed after ${attempt} attempts (${url}): ${err}`);
    await new Promise((r) => setTimeout(r, Math.min(5000 * 2 ** (attempt - 1), 60_000)));
    return getJson<T>(url, attempt + 1);
  }
}

async function allRows(datasetId: string, query = ""): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await getJson<RawRow[]>(`${API_BASE}/${datasetId}/data?size=${PAGE_SIZE}&offset=${offset}${query}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

const sha = (text: string) => crypto.createHash("sha256").update(text).digest("hex");

function latestJsonIn(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

/** Pulls the latest change-of-ownership and owner files; writes a new dated snapshot only if the content changed. */
export async function pullChangesOfOwnership(catalog: Catalog, log: (msg: string) => void = console.log): Promise<string> {
  const changes: OwnershipChange[] = [];
  const versions = {} as ChowSnapshot["versions"];
  const ownerRows: RawRow[] = [];
  for (const kind of ["hospital", "snf"] as const) {
    const [latest] = versionsOf(catalog, CATALOG_TITLES[kind].chow);
    const rows = await allRows(latest.datasetId);
    versions[kind] = { ...latest, rowCount: rows.length };
    for (const row of rows) {
      const change = toOwnershipChange(row, kind);
      if (change) changes.push(change);
    }
    const [ownersLatest] = versionsOf(catalog, CATALOG_TITLES[kind].chowOwners);
    ownerRows.push(...(await allRows(ownersLatest.datasetId, "&column=ENROLLMENT ID,TYPE - OWNER,ROLE CODE - OWNER,ORGANIZATION NAME - OWNER".replace(/ /g, "%20"))));
    log(`[ownership] ${kind} changes of ownership: ${rows.length} rows (${latest.periodStart} to ${latest.periodEnd})`);
  }
  changes.sort((a, b) => a.kind.localeCompare(b.kind) || a.effectiveDate.localeCompare(b.effectiveDate) || a.ccn.localeCompare(b.ccn));
  const newestYear = Number(changes.map((c) => c.effectiveDate).sort().at(-1)!.slice(0, 4));
  const recentBuyers = new Set(changes.filter((c) => Number(c.effectiveDate.slice(0, 4)) > newestYear - OWNER_LOOKBACK_YEARS).map((c) => c.buyerEnrollmentId));

  const snapshotsDir = path.join(CHOW_DIR, "snapshots");
  const previous = latestJsonIn(snapshotsDir);
  // Past versions never change, so their year counts are reused from the last snapshot.
  const vintages: Record<string, Record<string, number>> = previous ? { ...(JSON.parse(fs.readFileSync(previous, "utf-8")) as ChowSnapshot).vintages } : {};
  for (const kind of ["hospital", "snf"] as const) {
    for (const version of versionsOf(catalog, CATALOG_TITLES[kind].chow)) {
      const key = `${kind}|${quarterOfPeriod(version.periodStart)}`;
      if (vintages[key] && version.datasetId !== versions[kind].datasetId) continue;
      vintages[key] = countByYear(await allRows(version.datasetId, "&column=EFFECTIVE%20DATE"));
    }
  }
  const sortedVintages = Object.fromEntries(Object.entries(vintages).sort((a, b) => a[0].localeCompare(b[0])));
  // Every hospital change is kept (under 1,000); SNF changes only for the lookback window, since the
  // yearly SNF history is already in the latest version's vintage counts.
  const kept = changes.filter((c) => c.kind === "hospital" || Number(c.effectiveDate.slice(0, 4)) > newestYear - OWNER_LOOKBACK_YEARS);
  const content = { dataset: CHOW_DATASET_NAME, versions, changes: kept, buyerOwners: buyerOwnersFrom(ownerRows, recentBuyers), vintages: sortedVintages };

  if (previous) {
    const { pulledAt: _p, ...prior } = JSON.parse(fs.readFileSync(previous, "utf-8")) as ChowSnapshot;
    void _p;
    if (sha(JSON.stringify(prior)) === sha(JSON.stringify(content))) {
      log("[ownership] change-of-ownership files unchanged since the last snapshot");
      return previous;
    }
  }
  const pulledAt = new Date().toISOString();
  const snapshot: ChowSnapshot = { ...content, pulledAt };
  fs.mkdirSync(snapshotsDir, { recursive: true });
  const file = path.join(snapshotsDir, `${pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot));
  return file;
}

/** Pulls every monthly All Owners version that carries the private equity flag and isn't on disk yet (PE-flagged rows only). */
export async function pullPrivateEquityOwners(catalog: Catalog, log: (msg: string) => void = console.log): Promise<string> {
  const monthsDir = path.join(PE_DIR, "months");
  fs.mkdirSync(monthsDir, { recursive: true });
  const filter = `&${encodeURIComponent(`filter[${PE_COLUMN}]`)}=Y`;
  for (const kind of ["hospital", "snf"] as const) {
    for (const version of versionsOf(catalog, CATALOG_TITLES[kind].allOwners)) {
      const month = version.periodStart.slice(0, 7);
      const file = path.join(monthsDir, `${kind}-${month}.json`);
      if (fs.existsSync(file)) continue;
      const [sample] = await getJson<RawRow[]>(`${API_BASE}/${version.datasetId}/data?size=1`);
      // Versions are newest first: once the flag is missing, every older version lacks it too.
      if (!sample || !(PE_COLUMN in sample)) break;
      const rows = privateEquityRows(await allRows(version.datasetId, filter));
      const summary: PrivateEquityMonth = { dataset: PE_DATASET_NAME, kind, month, datasetId: version.datasetId, rows };
      fs.writeFileSync(file, JSON.stringify(summary));
      log(`[ownership] ${kind} all owners ${month}: ${rows.length} private equity owner rows`);
    }
  }
  const files = fs.readdirSync(monthsDir).filter((f) => f.endsWith(".json")).sort();
  const manifest: PeManifest = {
    dataset: PE_DATASET_NAME,
    pulledAt: new Date().toISOString(),
    files: Object.fromEntries(files.map((f) => [f, sha(fs.readFileSync(path.join(monthsDir, f), "utf-8"))])),
  };
  const snapshotsDir = path.join(PE_DIR, "snapshots");
  fs.mkdirSync(snapshotsDir, { recursive: true });
  const out = path.join(snapshotsDir, `${manifest.pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  return out;
}

export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string[]> {
  const catalog = await fetchCatalog();
  return [await pullChangesOfOwnership(catalog, log), await pullPrivateEquityOwners(catalog, log)];
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function loadLatestChowSnapshot(dir: string = path.join(CHOW_DIR, "snapshots")): ChowSnapshot | null {
  const file = latestJsonIn(dir);
  return file ? (JSON.parse(fs.readFileSync(file, "utf-8")) as ChowSnapshot) : null;
}

export function loadPrivateEquityMonths(dir: string = path.join(PE_DIR, "months")): PrivateEquityMonth[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^(hospital|snf)-\d{4}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as PrivateEquityMonth);
}
