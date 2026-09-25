/**
 * CMS Health Insurance Exchange Public Use Files (Marketplace PUFs) - the
 * Rate PUF joined to the Plan Attributes PUF, summarized per plan year at
 * pull time for every HealthCare.gov state, 2014 onward.
 *
 * Verified live 2026-09-25 (rebuilt from the 2026-09-23 5-state sample):
 * - https://www.cms.gov/marketplace/resources/data/public-use-files links
 *   download.cms.gov/marketplace-puf/<year>/rate-puf.zip and
 *   plan-attributes-puf.zip for every plan year back to 2014.
 * - The files cover Federally-Facilitated Marketplace (HealthCare.gov)
 *   states only. States running their own exchange (CA, NY, WA, ...) are
 *   absent, and the set changes as states leave HealthCare.gov, so every
 *   trend compares only states present in both years.
 * - The Rate PUF mixes medical plans with stand-alone dental plans and
 *   small-group (SHOP) plans, and has no column saying which. The 5-state
 *   sample this replaced got that wrong: about 10,800 of its 14,200 rows
 *   were dental premiums under $50. Plan Attributes (DentalOnlyPlan,
 *   MarketCoverage, MetalLevel, joined on StandardComponentId = the Rate
 *   PUF's PlanId) is what separates them.
 * - Tobacco-rated plans carry Tobacco = "Tobacco User/Non-Tobacco User"
 *   with the non-tobacco rate in IndividualRate; the old "No Preference"
 *   filter silently dropped about half of all plans.
 * - SHOP plans also file quarterly rates (effective Apr/Jul/Oct); only
 *   rates effective January 1 of the plan year are used.
 * - Column order changes between years (2014 adds VersionNum, IssuerId2,
 *   FederalTIN) and 2014 quotes every field, so columns are looked up by
 *   header name. The 2014 Rate PUF unzips to 722MB, too large for one
 *   string, so the zip is streamed and parsed line by line.
 *
 * Reference age 40, the age KFF and CMS use for premium comparisons. The
 * benchmark premium is the second-lowest-cost silver plan (the plan the
 * premium tax credit is pegged to) in each rating area.
 *
 * NAMING: issuers are kept as opaque HIOS IssuerIds and used only as
 * counts and for entry/exit; Plan Attributes' marketing names are not
 * stored.
 *
 * Storage: one file per plan year under years/, and a dated manifest of
 * content hashes under snapshots/ for the reasoning change gate.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Unzip, UnzipInflate, unzipSync } from "fflate";
import { parseCsv } from "./csv";

export const SOURCE_ID = "cms:marketplace-rate-puf";
export const DATASET_NAME = "marketplace-rate-puf";
const PUF_PAGE_URL = "https://www.cms.gov/marketplace/resources/data/public-use-files";
const YEAR_LINK_PATTERN = /href="https:\/\/download\.cms\.gov\/marketplace-puf\/(\d{4})\/rate-puf\.zip"/g;
const zipUrl = (year: number, file: "rate-puf" | "plan-attributes-puf") => `https://download.cms.gov/marketplace-puf/${year}/${file}.zip`;
export const REFERENCE_AGE = "40";
/** Share of Rate PUF lines allowed to have the wrong field count before the pull fails rather than misread data. */
const MAX_MALFORMED_SHARE = 0.001;
const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; healthcare-intelligence-dashboard/1.0)" };

const DATA_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME);
const YEARS_DIR = path.join(DATA_DIR, "years");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");

/** One on-exchange, individual-market medical plan (a standard component; its cost-sharing variants share its rates). */
export interface PlanInfo {
  state: string;
  issuerId: string;
  metal: string;
  planType: string;
  /** In-network individual deductible of the standard on-exchange variant, dollars; null when not stated. */
  deductible: number | null;
  /** In-network individual out-of-pocket maximum, same variant. */
  moop: number | null;
}

export interface RatingAreaSummary {
  state: string;
  area: string;
  issuers: number;
  plans: number;
  /** Second-lowest-cost silver premium at the reference age (the only silver plan when there is one). */
  benchmark: number | null;
  lowestBronze: number | null;
}

export interface StateSummary {
  state: string;
  /** Opaque HIOS ids of issuers with an on-exchange medical plan rated in the state; used for counts and entry/exit only. */
  issuerIds: string[];
  plans: number;
  plansByMetal: Record<string, number>;
  plansByType: Record<string, number>;
  ratingAreas: number;
  /** Median across the state's rating areas (unweighted; rating areas, not counties). */
  benchmarkMedian: number | null;
  lowestBronzeMedian: number | null;
  silverDeductibleMedian: number | null;
  bronzeDeductibleMedian: number | null;
  silverMoopMedian: number | null;
}

export interface MarketplaceYearSummary {
  dataset: string;
  planYear: number;
  referenceAge: string;
  pulledAt: string;
  sourceUrls: string[];
  counts: {
    rateLines: number;
    /** Reference-age, January-1 rows of on-exchange individual medical plans. */
    keptRows: number;
    /** Such rows with a rate of 0 or 9999, excluded as implausible. */
    implausibleRates: number;
    malformedLines: number;
  };
  states: StateSummary[];
  ratingAreas: RatingAreaSummary[];
}

export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

/** "$4,500 " -> 4500; "Not Applicable" or blank -> null. Exported for tests. */
export function parseDollars(value: string | undefined): number | null {
  if (!value) return null;
  const m = value.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

const isBronze = (metal: string) => metal === "Bronze" || metal === "Expanded Bronze";

/**
 * StandardComponentId -> plan, for on-exchange individual-market medical
 * plans only. Deductible and out-of-pocket maximum come from the
 * "Standard <metal> On Exchange Plan" variant; the combined medical+drug
 * (TEHB) figure when deductibles are integrated, else the medical (MEHB)
 * one. Exported for tests.
 */
export function buildPlanMap(table: string[][]): Map<string, PlanInfo> {
  const header = table[0].map((h) => h.replace(/^﻿/, "").trim());
  const col = (name: string) => header.indexOf(name);
  const need = ["StateCode", "IssuerId", "MarketCoverage", "DentalOnlyPlan", "StandardComponentId", "PlanType", "MetalLevel", "CSRVariationType"];
  const missing = need.filter((n) => col(n) === -1);
  if (missing.length) throw new Error(`Plan Attributes PUF is missing ${missing.join(", ")}`);
  const get = (row: string[], name: string) => (col(name) === -1 ? undefined : row[col(name)]?.trim());

  const plans = new Map<string, PlanInfo>();
  for (const row of table.slice(1)) {
    if (get(row, "MarketCoverage") !== "Individual" || get(row, "DentalOnlyPlan") !== "No") continue;
    const variant = get(row, "CSRVariationType") ?? "";
    if (!/On Exchange|Cost Sharing|AV Level/.test(variant)) continue; // off-exchange-only plans don't set the benchmark
    const id = get(row, "StandardComponentId")!;
    const plan = plans.get(id) ?? {
      state: get(row, "StateCode")!,
      issuerId: get(row, "IssuerId")!,
      metal: get(row, "MetalLevel")!,
      planType: get(row, "PlanType") || "Unknown",
      deductible: null,
      moop: null,
    };
    if (/^Standard .* On Exchange Plan$/.test(variant)) {
      const integrated = get(row, "MedicalDrugDeductiblesIntegrated") === "Yes";
      plan.deductible = parseDollars(get(row, integrated ? "TEHBDedInnTier1Individual" : "MEHBDedInnTier1Individual"));
      plan.moop = parseDollars(get(row, integrated ? "TEHBInnTier1IndividualMOOP" : "MEHBInnTier1IndividualMOOP"));
    }
    plans.set(id, plan);
  }
  return plans;
}

/** Streaming state for one Rate PUF: feed it lines, then summarize. Exported for tests. */
export function createRateSummarizer(planYear: number, plans: Map<string, PlanInfo>) {
  let header: string[] | null = null;
  const idx: Record<string, number> = {};
  const counts = { rateLines: 0, keptRows: 0, implausibleRates: 0, malformedLines: 0 };
  /** state|area -> planId -> rate */
  const areaRates = new Map<string, Map<string, number>>();
  const effective = `${planYear}-01-01`;

  const split = (line: string) => line.split(",").map((f) => (f.length >= 2 && f.startsWith('"') && f.endsWith('"') ? f.slice(1, -1) : f));

  function addLine(raw: string) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (!line) return;
    if (!header) {
      header = split(line).map((h) => h.replace(/^﻿/, "").trim());
      for (const name of ["StateCode", "PlanId", "RatingAreaId", "Age", "IndividualRate", "RateEffectiveDate"]) {
        idx[name] = header.indexOf(name);
        if (idx[name] === -1) throw new Error(`Rate PUF is missing ${name} - header was: ${header.join(", ")}`);
      }
      return;
    }
    counts.rateLines++;
    const fields = split(line);
    if (fields.length !== header.length) {
      counts.malformedLines++;
      return;
    }
    if (fields[idx.Age] !== REFERENCE_AGE || !fields[idx.RateEffectiveDate].startsWith(effective)) return;
    const planId = fields[idx.PlanId];
    if (!plans.has(planId)) return;
    counts.keptRows++;
    const rate = Number(fields[idx.IndividualRate]);
    if (!(rate > 0) || rate >= 9999) {
      counts.implausibleRates++;
      return;
    }
    const key = `${fields[idx.StateCode]}|${fields[idx.RatingAreaId]}`;
    if (!areaRates.has(key)) areaRates.set(key, new Map());
    areaRates.get(key)!.set(planId, rate);
  }

  function summarize(sourceUrls: string[]): MarketplaceYearSummary {
    if (counts.rateLines > 0 && counts.malformedLines / counts.rateLines > MAX_MALFORMED_SHARE) {
      throw new Error(`Rate PUF ${planYear}: ${counts.malformedLines} of ${counts.rateLines} lines had the wrong field count - the file format may have changed`);
    }
    const ratingAreas: RatingAreaSummary[] = [];
    const statePlans = new Map<string, Set<string>>();
    for (const [key, rates] of areaRates) {
      const [state, area] = key.split("|");
      const silver: number[] = [];
      const bronze: number[] = [];
      const issuers = new Set<string>();
      for (const [planId, rate] of rates) {
        const plan = plans.get(planId)!;
        issuers.add(plan.issuerId);
        if (plan.metal === "Silver") silver.push(rate);
        if (isBronze(plan.metal)) bronze.push(rate);
        if (!statePlans.has(state)) statePlans.set(state, new Set());
        statePlans.get(state)!.add(planId);
      }
      silver.sort((a, b) => a - b);
      ratingAreas.push({
        state,
        area,
        issuers: issuers.size,
        plans: rates.size,
        benchmark: silver.length ? silver[Math.min(1, silver.length - 1)] : null,
        lowestBronze: bronze.length ? Math.min(...bronze) : null,
      });
    }
    ratingAreas.sort((a, b) => a.state.localeCompare(b.state) || a.area.localeCompare(b.area, undefined, { numeric: true }));

    const states: StateSummary[] = [...statePlans.entries()]
      .map(([state, ids]) => {
        const list = [...ids].map((id) => plans.get(id)!);
        const areas = ratingAreas.filter((a) => a.state === state);
        const tally = (key: (p: PlanInfo) => string) => list.reduce<Record<string, number>>((acc, p) => ((acc[key(p)] = (acc[key(p)] ?? 0) + 1), acc), {});
        const deductibles = (test: (m: string) => boolean) => list.filter((p) => test(p.metal) && p.deductible !== null).map((p) => p.deductible!);
        return {
          state,
          issuerIds: [...new Set(list.map((p) => p.issuerId))].sort(),
          plans: list.length,
          plansByMetal: tally((p) => p.metal),
          plansByType: tally((p) => p.planType),
          ratingAreas: areas.length,
          benchmarkMedian: round2(median(areas.flatMap((a) => (a.benchmark === null ? [] : [a.benchmark])))),
          lowestBronzeMedian: round2(median(areas.flatMap((a) => (a.lowestBronze === null ? [] : [a.lowestBronze])))),
          silverDeductibleMedian: median(deductibles((m) => m === "Silver")),
          bronzeDeductibleMedian: median(deductibles(isBronze)),
          silverMoopMedian: median(list.filter((p) => p.metal === "Silver" && p.moop !== null).map((p) => p.moop!)),
        };
      })
      .sort((a, b) => a.state.localeCompare(b.state));

    return { dataset: DATASET_NAME, planYear, referenceAge: REFERENCE_AGE, pulledAt: new Date().toISOString(), sourceUrls, counts, states, ratingAreas };
  }

  return { addLine, summarize };
}

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  } catch (err) {
    if (attempt >= 5) throw new Error(`CMS Marketplace download failed after ${attempt} attempts (${url}): ${err}`, { cause: err });
    await new Promise((r) => setTimeout(r, 5000 * 2 ** (attempt - 1)));
    return fetchWithRetry(url, attempt + 1);
  }
}

/** Plan years with a Rate PUF link on CMS's index page. */
export async function listPlanYears(): Promise<number[]> {
  const html = await (await fetchWithRetry(PUF_PAGE_URL)).text();
  const years = [...new Set([...html.matchAll(YEAR_LINK_PATTERN)].map((m) => Number(m[1])))].sort();
  if (years.length === 0) throw new Error(`No rate-puf.zip links found on ${PUF_PAGE_URL} - page structure may have changed`);
  return years;
}

async function loadPlanMap(year: number): Promise<Map<string, PlanInfo>> {
  const bytes = new Uint8Array(await (await fetchWithRetry(zipUrl(year, "plan-attributes-puf"))).arrayBuffer());
  const files = unzipSync(bytes);
  const name = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (!name) throw new Error(`No CSV inside the ${year} Plan Attributes PUF`);
  return buildPlanMap(parseCsv(Buffer.from(files[name]).toString("utf-8")));
}

/** Streams the zip's CSV through `onLine` without holding the file in memory. */
async function streamZipLines(url: string, onLine: (line: string) => void): Promise<void> {
  const res = await fetchWithRetry(url);
  if (!res.body) throw new Error(`Empty response body (${url})`);
  const decoder = new TextDecoder("utf-8");
  let carry = "";
  let found = false;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (file) => {
    if (found || !file.name.toLowerCase().endsWith(".csv")) return;
    found = true;
    file.ondata = (err, chunk, final) => {
      if (err) throw err;
      const text = carry + decoder.decode(chunk, { stream: !final });
      const lines = text.split("\n");
      carry = final ? "" : lines.pop()!;
      for (const line of lines) onLine(line);
    };
    file.start();
  };
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) unzip.push(chunk);
  unzip.push(new Uint8Array(0), true);
  if (!found) throw new Error(`No CSV inside ${url}`);
}

export async function summarizePlanYear(year: number): Promise<MarketplaceYearSummary> {
  const plans = await loadPlanMap(year);
  const summarizer = createRateSummarizer(year, plans);
  await streamZipLines(zipUrl(year, "rate-puf"), summarizer.addLine);
  return summarizer.summarize([zipUrl(year, "rate-puf"), zipUrl(year, "plan-attributes-puf")]);
}

const yearFile = (year: number) => path.join(YEARS_DIR, `${year}.json`);
const hashFile = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/**
 * Summarizes every plan year not yet on disk, and always re-summarizes the
 * newest year (CMS republishes it with corrections during the year). The
 * content hashes, not pulledAt, decide whether anything changed.
 */
export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const years = await listPlanYears();
  const newest = years[years.length - 1];
  fs.mkdirSync(YEARS_DIR, { recursive: true });
  for (const year of years) {
    if (year !== newest && fs.existsSync(yearFile(year))) continue;
    const summary = await summarizePlanYear(year);
    const previous = fs.existsSync(yearFile(year)) ? loadYear(yearFile(year)) : null;
    // Keep the earlier pulledAt when nothing else changed, so an unchanged republish leaves the file (and its hash) alone.
    if (previous && JSON.stringify({ ...previous, pulledAt: "" }) === JSON.stringify({ ...summary, pulledAt: "" })) {
      log(`[marketplace] ${year}: unchanged`);
      continue;
    }
    fs.writeFileSync(yearFile(year), JSON.stringify(summary));
    log(`[marketplace] ${year}: ${summary.states.length} states, ${summary.ratingAreas.length} rating areas, ${summary.counts.keptRows} plan-area rates (${summary.counts.implausibleRates} implausible)`);
  }
  const manifest = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    years: Object.fromEntries(years.filter((y) => fs.existsSync(yearFile(y))).map((y) => [String(y), hashFile(yearFile(y))])),
  };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${manifest.pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return file;
}

function loadYear(file: string): MarketplaceYearSummary {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as MarketplaceYearSummary;
}

/** Every summarized plan year on disk, oldest first. */
export function loadAllPlanYears(dir: string = YEARS_DIR): MarketplaceYearSummary[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => loadYear(path.join(dir, f)));
}
