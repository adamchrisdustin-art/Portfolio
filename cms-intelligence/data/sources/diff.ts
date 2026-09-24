/**
 * Generic row-set diffing, generalizing the pattern already proven in
 * pipeline/watcherAgent.ts (which does this for exactly one dataset) so
 * the Data Source & CMS Change Monitor agent can apply it to any
 * registered source. See docs/cms-intelligence/AGENT_ARCHITECTURE.md
 * section 11 - this is that agent's actual diffing implementation.
 */

export interface RowDiff<T> {
  baseline: boolean;
  added: T[];
  removed: T[];
  changed: { identifier: string; field: string; from: unknown; to: unknown }[];
}

export function diffRows<T extends Record<string, unknown>>(
  previousRows: T[] | null,
  currentRows: T[],
  identifierField: keyof T,
  trackedFields: (keyof T)[]
): RowDiff<T> {
  if (!previousRows) {
    return { baseline: true, added: [], removed: [], changed: [] };
  }

  const prevById = new Map(previousRows.map((r) => [String(r[identifierField]), r]));
  const currById = new Map(currentRows.map((r) => [String(r[identifierField]), r]));

  const added: T[] = [];
  const changed: { identifier: string; field: string; from: unknown; to: unknown }[] = [];

  for (const [id, row] of currById) {
    const prevRow = prevById.get(id);
    if (!prevRow) {
      added.push(row);
      continue;
    }
    for (const field of trackedFields) {
      if (prevRow[field] !== row[field]) {
        changed.push({ identifier: id, field: String(field), from: prevRow[field], to: row[field] });
      }
    }
  }

  const removed: T[] = [];
  for (const [id, row] of prevById) {
    if (!currById.has(id)) removed.push(row);
  }

  return { baseline: false, added, removed, changed };
}

export function hasMaterialChange<T>(diff: RowDiff<T>): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
}
