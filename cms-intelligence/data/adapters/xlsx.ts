/**
 * Minimal .xlsx reader (added 2026-09-25 for CMS's 2017-2019 Marketplace
 * open enrollment workbooks). An .xlsx file is a zip of XML parts; this
 * reads sheet names and each sheet's cells as a grid of strings, which is
 * all a report workbook needs. It deliberately skips formatting, formulas
 * (it reads the cached value) and dates-as-serials: callers parse the
 * strings themselves. Uses fflate, already a dependency, rather than a
 * spreadsheet library.
 */
import { strFromU8, unzipSync } from "fflate";

export interface Workbook {
  sheetNames: string[];
  /** Rows of cell text; missing cells are "". */
  sheet(name: string): string[][];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === "#") return String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
    return ENTITIES[code] ?? whole;
  });
}

/** All <t> text inside one shared-string or inline-string element, joined (rich text splits it into runs). */
function textOf(xml: string): string {
  return decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
}

/** Column letters of a cell reference ("AB12") as a 0-based index. */
export function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)![0];
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

export function parseSheetXml(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(rowMatch[1].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1);
    const cells: string[] = [];
    for (const cellMatch of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const col = ref ? columnIndex(ref) : cells.length;
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s" && raw !== undefined) value = sharedStrings[Number(raw)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (raw !== undefined) value = decodeXml(raw);
      while (cells.length < col) cells.push("");
      cells[col] = value;
    }
    while (rows.length < rowNumber - 1) rows.push([]);
    rows[rowNumber - 1] = cells;
  }
  return rows;
}

export function readWorkbook(data: Uint8Array): Workbook {
  const files = unzipSync(data);
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : null);

  const shared = read("xl/sharedStrings.xml");
  const sharedStrings = shared ? [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];

  // Sheet name -> relationship id -> part path.
  const workbook = read("xl/workbook.xml") ?? "";
  const rels = read("xl/_rels/workbook.xml.rels") ?? "";
  const targetById = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [m[0].match(/\bId="([^"]+)"/)?.[1], m[0].match(/\bTarget="([^"]+)"/)?.[1]]));
  const partByName = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(m[0].match(/\bname="([^"]*)"/)?.[1] ?? "");
    const target = targetById.get(m[0].match(/\br:id="([^"]+)"/)?.[1]);
    if (target) partByName.set(name, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }

  return {
    sheetNames: [...partByName.keys()],
    sheet(name: string) {
      const part = partByName.get(name);
      const xml = part ? read(part) : null;
      if (!xml) throw new Error(`No sheet named "${name}" in workbook`);
      return parseSheetXml(xml, sharedStrings);
    },
  };
}
