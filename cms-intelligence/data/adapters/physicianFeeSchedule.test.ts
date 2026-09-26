import { describe, expect, it } from "vitest";
import { latestReleasePerYear, loadAllFeeScheduleYears, parseRvuCsv, pickRvuFile } from "./physicianFeeSchedule";

/** Header shape of the real files: titles, then a split header whose last two rows name each column. */
const header2019 = [
  ",,2019 National Physician Fee Schedule Relative Value File October Release,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
  ",,CPT codes and descriptions only are copyright 2019 American Medical Association.,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
  ",,,STATUS,MEDICARE,WORK,NON-FAC,NA,FACILITY,NA,MP,NON-FACILITY,FACILITY,PCTC,GLOB,PRE,INTRA,POST,MULT,BILAT,ASST,CO-,TEAM,ENDO,CONV,DIAGNOSTIC,CALCULATION,FAMILY,PAYMENT,PAYMENT,PAYMENT",
  "HCPCS,MOD,DESCRIPTION,CODE,PAYMENT,RVU,PE RVU,INDICATOR,PE RVU,INDICATOR,RVU,TOTAL,TOTAL,IND,DAYS,OP,OP,OP,PROC,SURG,SURG,SURG,SURG,BASE,FACTOR,PROCEDURES,FLAG,INDICATOR,AMOUNT,AMOUNT,AMOUNT",
];

describe("parseRvuCsv", () => {
  it("finds columns by the joined header rows and keeps only priced global rows, without descriptions", () => {
    const text = [
      ...header2019,
      '99213,,"Office/outpatient visit, est",A,,0.97,1.05,,0.40,,0.07,2.09,1.44,0,XXX,0.00,0.00,0.00,0,0,0,0,0,,36.0391,09,0,99,0.00,0.00,0.00',
      "77067,26,Scr mammo bi incl cad,A,,0.74,0.27,,0.27,,0.04,1.05,1.05,1,XXX,0.00,0.00,0.00,0,2,0,0,0,,36.0391,09,0,99,0.00,0.00,0.00",
      "00100,,Anes px salivary gland,J,,0.00,0.00,,0.00,,0.00,0.00,0.00,9,XXX,0.00,0.00,0.00,9,9,9,9,9,,36.0391,09,0,99,0.00,0.00,0.00",
    ].join("\r");
    const { conversionFactor, rows } = parseRvuCsv(text);
    expect(conversionFactor).toBe(36.0391);
    expect(rows).toEqual([{ code: "99213", statusCode: "A", nonFacilityTotalRvu: 2.09, facilityTotalRvu: 1.44 }]);
    expect(JSON.stringify(rows)).not.toMatch(/Office/);
  });

  it("handles 2026's extra column (PRIC IND) ahead of the conversion factor", () => {
    const h = header2019.map((line, i) => (i < 2 ? line : line.replace(i === 2 ? "TEAM,ENDO" : "SURG,BASE", i === 2 ? "TEAM,PRIC,ENDO" : "SURG,IND,BASE")));
    const text = [...h, "99214,,Office o/p est mod 30 min,A,,1.92,2.00,,0.47,,0.14,4.06,2.53,0,XXX,0.00,0.00,0.00,0,0,0,0,0,9,,33.4009,09,0,99,0.00,0.00,0.00"].join("\n");
    const { conversionFactor, rows } = parseRvuCsv(text);
    expect(conversionFactor).toBe(33.4009);
    expect(rows[0]).toMatchObject({ code: "99214", nonFacilityTotalRvu: 4.06, facilityTotalRvu: 2.53 });
  });
});

describe("release discovery", () => {
  it("keeps the latest release per year from 2013, following hrefs as published", () => {
    const html = [
      '<a href="/medicare/x/rvu24a">RVU24A</a>',
      '<a href="/medicare/x/rvu24ar">RVU24AR </a>',
      '<a href="/files/rvu24d">RVU24D</a>',
      '<a href="/medicaremedicare-fee-service-paymentphysicianfeeschedpfs-relative-value-files/rvu21d">RVU21D</a>',
      '<a href="/x/cms1239526">RVU10D_PCT0</a>',
      '<a href="/x/rvu12d">RVU12D</a>',
    ].join("\n");
    const releases = latestReleasePerYear(html);
    expect([...releases.keys()].sort()).toEqual([2021, 2024]);
    expect(releases.get(2024)).toEqual({ year: 2024, release: "RVU24D", url: "https://www.cms.gov/files/rvu24d" });
    expect(releases.get(2021)?.url).toBe("https://www.cms.gov/medicaremedicare-fee-service-paymentphysicianfeeschedpfs-relative-value-files/rvu21d");
  });

  it("picks the non-QPP national file when a zip has both", () => {
    expect(pickRvuFile(["GPCI2026.csv", "PPRRVU2026_Oct_QPP.csv", "PPRRVU2026_Oct_nonQPP.csv", "PPRRVU2026_Oct_nonQPP.xlsx"])).toBe("PPRRVU2026_Oct_nonQPP.csv");
    expect(pickRvuFile(["PPRRVU13_V0828.csv", "PPRRVU13_V0828.txt"])).toBe("PPRRVU13_V0828.csv");
  });
});

describe("committed fee schedule years", () => {
  it("cover 2013 onward with CMS's published conversion factors", () => {
    const years = loadAllFeeScheduleYears();
    const cf = new Map(years.map((y) => [y.year, y.conversionFactor]));
    expect(years[0].year).toBe(2013);
    expect(cf.get(2021)).toBe(34.8931);
    expect(cf.get(2026)).toBe(33.4009);
  });
});
