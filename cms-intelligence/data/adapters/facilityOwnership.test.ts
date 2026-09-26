import { describe, expect, it } from "vitest";
import {
  buyerOwnersFrom,
  countByYear,
  loadLatestChowSnapshot,
  loadPrivateEquityMonths,
  privateEquityRows,
  quarterOfPeriod,
  sameLagComparison,
  toOwnershipChange,
  versionsOf,
  type ChowSnapshot,
} from "./facilityOwnership";

const chowRow = {
  "ENROLLMENT ID - BUYER": "O20021125000001",
  "ENROLLMENT STATE - BUYER": "IN",
  "PROVIDER TYPE TEXT - BUYER": "PART A PROVIDER - HOSPITAL",
  "CCN - BUYER": "150056",
  "ORGANIZATION NAME - BUYER": "INDIANA UNIVERSITY HEALTH INC",
  "CHOW TYPE TEXT": "ACQUISITION/MERGER",
  "EFFECTIVE DATE": "2025-12-28",
  "ORGANIZATION NAME - SELLER": "INDIANA UNIVERSITY HEALTH NORTH HOSPITAL INC",
};

describe("toOwnershipChange", () => {
  it("keeps the buyer, seller, type, date and CCN", () => {
    expect(toOwnershipChange(chowRow, "hospital")).toEqual({
      kind: "hospital",
      effectiveDate: "2025-12-28",
      chowType: "ACQUISITION/MERGER",
      state: "IN",
      ccn: "150056",
      providerType: "PART A PROVIDER - HOSPITAL",
      buyerEnrollmentId: "O20021125000001",
      buyerName: "INDIANA UNIVERSITY HEALTH INC",
      sellerName: "INDIANA UNIVERSITY HEALTH NORTH HOSPITAL INC",
    });
  });

  it("drops rows without a real date or state", () => {
    expect(toOwnershipChange({ ...chowRow, "EFFECTIVE DATE": "" }, "hospital")).toBeNull();
    expect(toOwnershipChange({ ...chowRow, "ENROLLMENT STATE - BUYER": "" }, "snf")).toBeNull();
  });
});

describe("owner files", () => {
  it("keeps only 5%+ organization owners of the buyers asked for", () => {
    const rows = [
      { "ENROLLMENT ID": "A", "TYPE - OWNER": "O", "ROLE CODE - OWNER": "35", "ORGANIZATION NAME - OWNER": "PARENT CO" },
      { "ENROLLMENT ID": "A", "TYPE - OWNER": "O", "ROLE CODE - OWNER": "34", "ORGANIZATION NAME - OWNER": "HOLDCO LLC" },
      { "ENROLLMENT ID": "A", "TYPE - OWNER": "I", "ROLE CODE - OWNER": "34", "ORGANIZATION NAME - OWNER": "" },
      { "ENROLLMENT ID": "A", "TYPE - OWNER": "O", "ROLE CODE - OWNER": "40", "ORGANIZATION NAME - OWNER": "OFFICER ROLE" },
      { "ENROLLMENT ID": "B", "TYPE - OWNER": "O", "ROLE CODE - OWNER": "35", "ORGANIZATION NAME - OWNER": "NOT A BUYER" },
    ];
    expect(buyerOwnersFrom(rows, new Set(["A"]))).toEqual({ A: ["HOLDCO LLC", "PARENT CO"] });
  });

  it("keeps private equity rows with the owner's association date", () => {
    const rows = [
      { "ENROLLMENT ID": "E1", "ORGANIZATION NAME": "HOSP", "ORGANIZATION NAME - OWNER": "FUND LP", "ASSOCIATION DATE - OWNER": "2018-10-01", "PRIVATE EQUITY COMPANY - OWNER": "Y" },
      { "ENROLLMENT ID": "E2", "ORGANIZATION NAME": "HOSP 2", "ORGANIZATION NAME - OWNER": "OTHER", "ASSOCIATION DATE - OWNER": "2020-01-01", "PRIVATE EQUITY COMPANY - OWNER": "N" },
    ];
    expect(privateEquityRows(rows)).toEqual([["E1", "HOSP", "FUND LP", "2018-10-01"]]);
  });
});

describe("reporting lag", () => {
  it("counts changes by effective year as one release reported them", () => {
    expect(countByYear([{ "EFFECTIVE DATE": "2024-03-01" }, { "EFFECTIVE DATE": "2024-09-01" }, { "EFFECTIVE DATE": "2025-01-01" }, { "EFFECTIVE DATE": "" }])).toEqual({ "2024": 2, "2025": 1 });
  });

  it("compares the newest complete year with the prior year as reported a year earlier", () => {
    const snapshot = {
      versions: { hospital: { periodStart: "2026-04-01", periodEnd: "2026-06-30", datasetId: "x", rowCount: 0 }, snf: { periodStart: "2026-04-01", periodEnd: "2026-06-30", datasetId: "y", rowCount: 0 } },
      vintages: { "hospital|2026-Q2": { "2024": 98, "2025": 57 }, "hospital|2025-Q2": { "2024": 91 } },
    } as unknown as ChowSnapshot;
    expect(sameLagComparison(snapshot, "hospital")).toEqual({ version: "2026-Q2", priorVersion: "2025-Q2", year: 2025, count: 57, priorYear: 2024, priorCount: 91 });
    expect(sameLagComparison(snapshot, "snf")).toBeNull();
    expect(quarterOfPeriod("2025-10-01")).toBe("2025-Q4");
  });

  it("lists each catalog version once, newest first", () => {
    const catalog = {
      dataset: [
        {
          title: "Hospital Change of Ownership",
          distribution: [
            { accessURL: "https://data.cms.gov/data-api/v1/dataset/aaaa-1/data", temporal: "2026-04-01/2026-06-30" },
            { accessURL: "https://data.cms.gov/data-api/v1/dataset/bbbb-2/data", temporal: "2026-04-01/2026-06-30" },
            { accessURL: "https://data.cms.gov/sites/default/files/x.csv", temporal: "2026-01-01/2026-03-31" },
            { accessURL: "https://data.cms.gov/data-api/v1/dataset/cccc-3/data", temporal: "2026-01-01/2026-03-31" },
          ],
        },
      ],
    };
    expect(versionsOf(catalog, "Hospital Change of Ownership").map((v) => v.datasetId)).toEqual(["aaaa-1", "cccc-3"]);
  });
});

describe("committed ownership data", () => {
  it("has hospital and SNF changes with past releases for the same-lag comparison", () => {
    const snapshot = loadLatestChowSnapshot()!;
    expect(snapshot.changes.some((c) => c.kind === "hospital")).toBe(true);
    expect(snapshot.changes.some((c) => c.kind === "snf")).toBe(true);
    expect(sameLagComparison(snapshot, "hospital")).not.toBeNull();
    expect(sameLagComparison(snapshot, "snf")).not.toBeNull();
  });

  it("only has private equity months from when the field exists", () => {
    const months = loadPrivateEquityMonths();
    expect(months.filter((m) => m.kind === "hospital")[0].month >= "2025-04").toBe(true);
    expect(months.filter((m) => m.kind === "snf")[0].month >= "2024-11").toBe(true);
    // A release without the field would have returned every owner row, not a few hundred.
    for (const m of months) expect(m.rows.length).toBeLessThan(2000);
  });
});
