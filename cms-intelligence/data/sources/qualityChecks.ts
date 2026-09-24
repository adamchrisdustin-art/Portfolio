/**
 * Deterministic data-quality checks, per docs/cms-intelligence/
 * 04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md's "Data quality" section. Run
 * against a raw row set before it's used by any agent - a dataset that
 * fails these should be flagged, not silently used.
 */

export interface QualityIssue {
  check: string;
  severity: "warning" | "error";
  message: string;
  affectedCount?: number;
}

/** Flags rows missing any of the given required fields. */
export function checkMissingFields(rows: Record<string, unknown>[], requiredFields: string[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (const field of requiredFields) {
    const missingCount = rows.filter((r) => r[field] === undefined || r[field] === null || r[field] === "").length;
    if (missingCount > 0) {
      issues.push({
        check: "missing-fields",
        severity: missingCount === rows.length ? "error" : "warning",
        message: `${missingCount} of ${rows.length} rows missing "${field}"`,
        affectedCount: missingCount,
      });
    }
  }
  return issues;
}

/** Flags duplicate values of an identifier field that should be unique per row. */
export function checkDuplicateIdentifiers(rows: Record<string, unknown>[], identifierField: string): QualityIssue[] {
  const seen = new Map<unknown, number>();
  for (const row of rows) {
    const id = row[identifierField];
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const duplicates = Array.from(seen.entries()).filter(([, count]) => count > 1);
  if (duplicates.length === 0) return [];
  return [
    {
      check: "duplicate-identifiers",
      severity: "error",
      message: `${duplicates.length} duplicate value(s) of "${identifierField}" found`,
      affectedCount: duplicates.reduce((sum, [, count]) => sum + count, 0),
    },
  ];
}

/** Flags values in a field that fall outside an expected allow-list. */
export function checkUnexpectedCategoryValues(
  rows: Record<string, unknown>[],
  field: string,
  allowedValues: string[]
): QualityIssue[] {
  const unexpected = new Set<string>();
  for (const row of rows) {
    const value = row[field];
    if (typeof value === "string" && value.length > 0 && !allowedValues.includes(value)) {
      unexpected.add(value);
    }
  }
  if (unexpected.size === 0) return [];
  return [
    {
      check: "unexpected-category-values",
      severity: "warning",
      message: `"${field}" contains ${unexpected.size} value(s) outside the expected set: ${Array.from(unexpected).slice(0, 5).join(", ")}${unexpected.size > 5 ? ", ..." : ""}`,
    },
  ];
}

/** Flags date-like fields that don't parse to a real date. */
export function checkImpossibleDates(rows: Record<string, unknown>[], dateField: string): QualityIssue[] {
  let badCount = 0;
  for (const row of rows) {
    const value = row[dateField];
    if (typeof value !== "string" || value.length === 0) continue;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) badCount++;
  }
  if (badCount === 0) return [];
  return [
    {
      check: "impossible-dates",
      severity: "warning",
      message: `${badCount} unparseable value(s) in "${dateField}"`,
      affectedCount: badCount,
    },
  ];
}

/**
 * Flags a row-count swing between two snapshots larger than a given
 * percent - a real dataset publishing a 10x row-count change without
 * explanation is more likely a schema/scope change than a real signal.
 */
export function checkUnexplainedVolumeChange(previousCount: number, currentCount: number, maxPercentChange = 25): QualityIssue[] {
  if (previousCount === 0) return [];
  const percentChange = (Math.abs(currentCount - previousCount) / previousCount) * 100;
  if (percentChange <= maxPercentChange) return [];
  return [
    {
      check: "unexplained-volume-change",
      severity: "warning",
      message: `Row count changed ${percentChange.toFixed(1)}% (${previousCount} -> ${currentCount}), exceeding the ${maxPercentChange}% review threshold - confirm this is a real data change, not a schema/scope change, before trusting downstream calculations.`,
    },
  ];
}

/** Flags fields present in one row set but missing from another - a lightweight schema-drift check. */
export function checkSchemaDrift(previousFields: string[], currentFields: string[]): QualityIssue[] {
  const prevSet = new Set(previousFields);
  const currSet = new Set(currentFields);
  const removed = previousFields.filter((f) => !currSet.has(f));
  const added = currentFields.filter((f) => !prevSet.has(f));
  const issues: QualityIssue[] = [];
  if (removed.length > 0) {
    issues.push({ check: "schema-drift", severity: "error", message: `Field(s) removed since last check: ${removed.join(", ")}` });
  }
  if (added.length > 0) {
    issues.push({ check: "schema-drift", severity: "warning", message: `New field(s) since last check: ${added.join(", ")}` });
  }
  return issues;
}

/** Flags a geography value present previously but absent from the current data - a possible unexpected coverage loss. */
export function checkUnexpectedGeographicLoss(previousGeographies: string[], currentGeographies: string[]): QualityIssue[] {
  const currSet = new Set(currentGeographies);
  const missing = Array.from(new Set(previousGeographies)).filter((g) => !currSet.has(g));
  if (missing.length === 0) return [];
  return [
    {
      check: "unexpected-geographic-loss",
      severity: "error",
      message: `${missing.length} geography value(s) present previously are absent now: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ", ..." : ""}`,
    },
  ];
}

export function runAllChecks(issues: QualityIssue[][]): { hasErrors: boolean; issues: QualityIssue[] } {
  const flat = issues.flat();
  return { hasErrors: flat.some((i) => i.severity === "error"), issues: flat };
}
