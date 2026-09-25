/**
 * Builds a minimal real .xlsx in memory for tests (xlsx.test.ts,
 * marketplaceEnrollment.test.ts): shared strings for text cells, plain
 * values for numbers, one part per sheet.
 */
import { strToU8, zipSync } from "fflate";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function columnLetters(index: number): string {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

export function buildWorkbook(sheets: Record<string, (string | number)[][]>): Uint8Array {
  const shared: string[] = [];
  const sharedIndex = (text: string) => {
    const i = shared.indexOf(text);
    return i === -1 ? shared.push(text) - 1 : i;
  };
  const names = Object.keys(sheets);
  const files: Record<string, Uint8Array> = {};
  names.forEach((name, s) => {
    const rows = sheets[name]
      .map((row, r) => {
        const cells = row
          .map((value, c) => {
            const ref = `${columnLetters(c)}${r + 1}`;
            return typeof value === "number" ? `<c r="${ref}"><v>${value}</v></c>` : value === "" ? "" : `<c r="${ref}" t="s"><v>${sharedIndex(value)}</v></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    files[`xl/worksheets/sheet${s + 1}.xml`] = strToU8(`<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`);
  });
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0"?><workbook xmlns:r="r"><sheets>${names.map((n, s) => `<sheet name="${escape(n)}" sheetId="${s + 1}" r:id="rId${s + 1}"/>`).join("")}</sheets></workbook>`
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0"?><Relationships>${names.map((_, s) => `<Relationship Id="rId${s + 1}" Type="worksheet" Target="worksheets/sheet${s + 1}.xml"/>`).join("")}</Relationships>`
  );
  files["xl/sharedStrings.xml"] = strToU8(`<?xml version="1.0"?><sst>${shared.map((t) => `<si><t>${escape(t)}</t></si>`).join("")}</sst>`);
  return zipSync(files);
}
