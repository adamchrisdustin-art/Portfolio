/**
 * Medicaid Managed Care Enrollment by Program and Plan (data.medicaid.gov
 * dataset 0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe). Added 2026-09-25 for Q064
 * (what managed care changes matter).
 *
 * Verified live 2026-09-25:
 * - Annual, one row per state, program and plan, 2016-2024 (2024 published
 *   February 2026). Public DKAN datastore API, no key.
 * - A person is counted once per program they're in, so medical, dental,
 *   behavioral health and transportation programs double-count. Only
 *   comprehensive managed care (program names containing "Comprehensive
 *   MCO") is counted as enrollment. Some states also list dental or
 *   pharmacy benefit plans inside that program (Tennessee: DentaQuest
 *   1.43M and OptumRx 1.28M in 2024), which counts the same people again,
 *   so those plans are excluded by name (isSpecialtyPlan).
 * - parent_organization is as each state reports it: the same company can
 *   appear under several names ("UnitedHealthcare", "UnitedHealth Group")
 *   and subsidiaries appear as their own parents. Only spellings of the
 *   same name are merged (see normalizeParent); different names are never
 *   merged from outside knowledge. 2016 has no parent names.
 *
 * Storage: one dated snapshot of every row, the fields used, with state
 * as a two-letter code (null for territories).
 */
import fs from "node:fs";
import path from "node:path";
import { stateCode } from "../sources/states";

export const SOURCE_ID = "cms:medicaid-managed-care-plans";
export const DATASET_NAME = "medicaid-managed-care-plans";
const DATASET_ID = "0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe";
const BASE_URL = `https://data.medicaid.gov/api/1/datastore/query/${DATASET_ID}/0`;
const PAGE_SIZE = 500;
const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

export interface ManagedCarePlanRow {
  year: number;
  /** Two-letter code, or null for territories. */
  state: string | null;
  stateName: string;
  program: string;
  plan: string;
  /** As the state reported it; "" when blank. */
  parent: string;
  /** Comprehensive managed care (medical coverage), the only programs counted as enrollment. */
  comprehensive: boolean;
  medicaidOnlyEnrollment: number | null;
  dualEnrollment: number | null;
  totalEnrollment: number | null;
}

export interface ManagedCareSnapshot {
  dataset: string;
  datasetId: string;
  pulledAt: string;
  rowCount: number;
  rows: ManagedCarePlanRow[];
}

type RawRow = Record<string, string | null>;

function parseCount(raw: string | null | undefined): number | null {
  const text = (raw ?? "").replace(/,/g, "").trim();
  if (text === "" || text === "--" || text.toLowerCase() === "n/a") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** A dental or pharmacy benefit plan listed inside a comprehensive program; its members are already counted in the medical plans. */
export function isSpecialtyPlan(plan: string, parent: string): boolean {
  return /\bdental\b|dentaquest|\brx\b|optumrx|pharmacy/i.test(`${plan} ${parent}`);
}

/** One raw API row as a stored row, or null when it has no usable year. Exported for tests. */
export function toPlanRow(row: RawRow): ManagedCarePlanRow | null {
  const yearText = (row.year ?? "").trim();
  const year = Number(yearText);
  if (!/^\d{4}$/.test(yearText)) return null;
  const program = (row.program_name ?? "").trim();
  return {
    year,
    state: stateCode(row.state),
    stateName: (row.state ?? "").trim(),
    program,
    plan: (row.plan_name ?? "").trim(),
    parent: (row.parent_organization ?? "").trim(),
    comprehensive: /comprehensive mco/i.test(program) && !isSpecialtyPlan(row.plan_name ?? "", row.parent_organization ?? ""),
    medicaidOnlyEnrollment: parseCount(row.medicaidonly_enrollment),
    dualEnrollment: parseCount(row.dual_enrollment),
    totalEnrollment: parseCount(row.total_enrollment),
  };
}

/**
 * Merges spellings of the same parent name only: case, punctuation,
 * spacing and a trailing corporate suffix ("Molina Healthcare, Inc." and
 * "Molina Healthcare"; "Centene Corporation" and "Centene"). Different
 * names stay separate even when they're known to be one company.
 */
export function normalizeParent(name: string): string {
  return name
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(Inc|Incorporated|Corporation|Corp|Company|Co|LLC|LP|Ltd)$/i, "")
    .trim();
}

async function fetchPage(offset: number): Promise<{ results: RawRow[]; count: number }> {
  const url = `${BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}&count=true&schema=false`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as { results: RawRow[]; count: number };
    } catch (err) {
      if (attempt >= 4) throw new Error(`Medicaid managed care query failed after ${attempt} attempts (${url}): ${err}`, { cause: err });
      await new Promise((r) => setTimeout(r, 3000 * 2 ** (attempt - 1)));
    }
  }
}

/** Live pull + snapshot to disk - run manually or on schedule, never from a page load. */
export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const rows: ManagedCarePlanRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchPage(offset);
    for (const raw of page.results) {
      const row = toPlanRow(raw);
      if (row) rows.push(row);
    }
    if (offset + PAGE_SIZE >= page.count || page.results.length === 0) break;
  }
  const years = [...new Set(rows.map((r) => r.year))].sort();
  log(`[medicaid-managed-care] ${rows.length} plan rows, ${years[0]}-${years.at(-1)}, ${rows.filter((r) => r.comprehensive).length} comprehensive`);
  const pulledAt = new Date().toISOString();
  const snapshot: ManagedCareSnapshot = { dataset: DATASET_NAME, datasetId: DATASET_ID, pulledAt, rowCount: rows.length, rows };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot));
  return file;
}

export function loadLatestSnapshot(dir: string = SNAPSHOTS_DIR): ManagedCareSnapshot | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.length === 0 ? null : (JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf-8")) as ManagedCareSnapshot);
}
