import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { columnIndex, decodeXml, parseSheetXml, readWorkbook } from "./xlsx";
import { buildWorkbook } from "./xlsxTestWorkbook";

describe("columnIndex", () => {
  it("converts column letters to 0-based indexes", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("Z9")).toBe(25);
    expect(columnIndex("AA10")).toBe(26);
  });
});

describe("decodeXml", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeXml("A &amp; B &lt;&gt; &#8224; &#x2020;")).toBe("A & B <> † †");
  });
});

describe("parseSheetXml", () => {
  it("places cells by reference, filling skipped cells and rows with blanks", () => {
    const xml = '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>42</v></c></row><row r="3"><c r="B3" t="inlineStr"><is><t>inline</t></is></c></row></sheetData>';
    expect(parseSheetXml(xml, ["shared"])).toEqual([["shared", "", "42"], [], ["", "inline"]]);
  });

  it("joins rich-text runs in a shared string", () => {
    const xml = '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData>';
    expect(parseSheetXml(xml, ["Arkansas†"])).toEqual([["Arkansas†"]]);
  });
});

describe("readWorkbook", () => {
  it("reads sheet names and their cells", () => {
    const wb = readWorkbook(buildWorkbook({ Methods: [["About"]], "(2) Plan Selections": [["State", "Count"], ["AK", 19145]] }));
    expect(wb.sheetNames).toEqual(["Methods", "(2) Plan Selections"]);
    expect(wb.sheet("(2) Plan Selections")).toEqual([["State", "Count"], ["AK", "19145"]]);
  });

  it("reads rich-text shared strings split into runs", () => {
    const files = {
      "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      "xl/sharedStrings.xml": strToU8('<sst><si><r><t>Total </t></r><r><rPr/><t xml:space="preserve">Consumers</t></r></si></sst>'),
      "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>'),
    };
    expect(readWorkbook(zipSync(files)).sheet("S")).toEqual([["Total Consumers"]]);
  });

  it("throws on a sheet that doesn't exist", () => {
    expect(() => readWorkbook(buildWorkbook({ A: [["x"]] })).sheet("B")).toThrow(/No sheet named "B"/);
  });
});
