/**
 * State Medicaid and CHIP Applications, Eligibility Determinations, and
 * Enrollment Data (CMS's Medicaid & CHIP "Performance Indicator" data,
 * data.medicaid.gov dataset 6165f45b-ca93-5bb5-9d06-db29c692a360). Added
 * 2026-09-25 as the Medicaid agent's first real source (Q056).
 *
 * Verified live 2026-09-25:
 * - Monthly, every state and DC, September 2013 onward (latest 2026-06),
 *   through the same public DKAN datastore API family as the CMS provider
 *   data sources. No key, no data use agreement.
 * - States report each month twice: a preliminary row ("P") and, about a
 *   month later, an updated final row ("U"). Preliminary totals run lower
 *   (NC May 2026: 2,820,258 P vs 2,835,788 U), so a preliminary month is
 *   only ever compared with another preliminary month - see
 *   bestReportFor / comparableValue.
 * - State-reported, not T-MSIS claims: counts are what each state's
 *   eligibility system reports, on its own cadence and definitions. The
 *   restricted T-MSIS research files (TAF) need a CMS data use agreement
 *   and are not used.
 * - No disenrollment or renewal counts, so churn (Q057) isn't answerable
 *   from this file; net change is.
 *
 * Storage: one dated snapshot of every state-month report, only the
 * fields used (enrollment splits, applications, determinations,
 * expansion status, report status).
 */
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "cms:medicaid-state-enrollment";
export const DATASET_NAME = "medicaid-state-enrollment";
const DATASET_ID = "6165f45b-ca93-5bb5-9d06-db29c692a360";
const BASE_URL = `https://data.medicaid.gov/api/1/datastore/query/${DATASET_ID}/0`;
const PAGE_SIZE = 500;
const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

/** Source field -> stored field. */
const FIELDS = {
  total_medicaid_and_chip_enrollment: "totalEnrollment",
  total_medicaid_enrollment: "medicaidEnrollment",
  total_chip_enrollment: "chipEnrollment",
  total_adult_medicaid_enrollment: "adultMedicaidEnrollment",
  medicaid_and_chip_child_enrollment: "childEnrollment",
  new_applications_submitted_to_medicaid_and_chip_agencies: "newApplications",
  total_medicaid_and_chip_determinations: "determinations",
} as const;
type NumericField = (typeof FIELDS)[keyof typeof FIELDS];

export type MedicaidReport = {
  state: string;
  /** "YYYY-MM". */
  month: string;
  /** "P" preliminary, "U" updated (final). */
  status: "P" | "U";
  expandedMedicaid: boolean | null;
} & Record<NumericField, number | null>;

export interface MedicaidEnrollmentSnapshot {
  dataset: string;
  datasetId: string;
  pulledAt: string;
  reportCount: number;
  reports: MedicaidReport[];
}

type RawRow = Record<string, string | null>;

/** "1,358,101" or "1358101" -> number; blank or non-numeric -> null, never 0. Exported for tests. */
export function parseCount(raw: string | null | undefined): number | null {
  const text = (raw ?? "").replace(/,/g, "").trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** One raw API row as a stored report, or null when it isn't a usable state-month report. Exported for tests. */
export function toReport(row: RawRow): MedicaidReport | null {
  const state = row.state_abbreviation?.trim();
  const period = row.reporting_period?.trim();
  const status = row.preliminary_or_updated?.trim();
  if (!state || !/^[A-Z]{2}$/.test(state) || !period || !/^\d{6}$/.test(period) || (status !== "P" && status !== "U")) return null;
  const expanded = row.state_expanded_medicaid?.trim();
  const report = {
    state,
    month: `${period.slice(0, 4)}-${period.slice(4)}`,
    status,
    expandedMedicaid: expanded === "Y" ? true : expanded === "N" ? false : null,
  } as MedicaidReport;
  for (const [source, stored] of Object.entries(FIELDS)) report[stored as NumericField] = parseCount(row[source]);
  return report;
}

async function fetchPage(offset: number): Promise<{ results: RawRow[]; count: number }> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), count: "true", schema: "false" });
  for (const field of ["state_abbreviation", "reporting_period", "preliminary_or_updated", "state_expanded_medicaid", ...Object.keys(FIELDS)]) params.append("properties[]", field);
  const url = `${BASE_URL}?${params}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as { results: RawRow[]; count: number };
    } catch (err) {
      if (attempt >= 4) throw new Error(`Medicaid enrollment query failed after ${attempt} attempts (${url}): ${err}`, { cause: err });
      await new Promise((r) => setTimeout(r, 3000 * 2 ** (attempt - 1)));
    }
  }
}

/** Live pull + snapshot to disk - run manually or on schedule, never from a page load. */
export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const reports: MedicaidReport[] = [];
  let skipped = 0;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchPage(offset);
    for (const row of page.results) {
      const report = toReport(row);
      if (report) reports.push(report);
      else skipped++;
    }
    if (offset + PAGE_SIZE >= page.count || page.results.length === 0) break;
  }
  reports.sort((a, b) => a.state.localeCompare(b.state) || a.month.localeCompare(b.month) || a.status.localeCompare(b.status));
  const states = new Set(reports.map((r) => r.state));
  if (states.size < 51) throw new Error(`Medicaid enrollment: expected 50 states and DC, found ${states.size}`);
  log(`[medicaid-enrollment] ${reports.length} state-month reports, ${states.size} states, ${reports[0]?.month}..${reports.map((r) => r.month).sort().at(-1)}${skipped ? `, ${skipped} unusable rows skipped` : ""}`);

  const pulledAt = new Date().toISOString();
  const snapshot: MedicaidEnrollmentSnapshot = { dataset: DATASET_NAME, datasetId: DATASET_ID, pulledAt, reportCount: reports.length, reports };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot));
  return file;
}

export function loadLatestSnapshot(dir: string = SNAPSHOTS_DIR): MedicaidEnrollmentSnapshot | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.length === 0 ? null : (JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf-8")) as MedicaidEnrollmentSnapshot);
}

/** A state's final report for the month if there is one, otherwise its preliminary one. */
export function bestReportFor(reports: MedicaidReport[], state: string, month: string): MedicaidReport | null {
  const matches = reports.filter((r) => r.state === state && r.month === month);
  return matches.find((r) => r.status === "U") ?? matches.find((r) => r.status === "P") ?? null;
}

/**
 * A state's value for a month in the requested report status, so two
 * months are compared like with like (final with final, preliminary with
 * preliminary). Null when the state didn't file that status or left the
 * field blank.
 */
export function comparableValue(reports: MedicaidReport[], state: string, month: string, status: "P" | "U", field: NumericField): number | null {
  return reports.find((r) => r.state === state && r.month === month && r.status === status)?.[field] ?? null;
}
