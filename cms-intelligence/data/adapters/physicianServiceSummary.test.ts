import { describe, expect, it } from "vitest";
import { buildRbcsMap, loadAllServiceYears, summarizeServiceRows } from "./physicianServiceSummary";

describe("summarizeServiceRows", () => {
  it("combines each code's facility and office rows, turning per-service averages into totals", () => {
    const year = summarizeServiceRows(
      [
        { HCPCS_Cd: "99214", HCPCS_Desc: "Office visit", HCPCS_Drug_Ind: "N", Place_Of_Srvc: "O", Tot_Srvcs: "100", Tot_Benes: "80", Avg_Sbmtd_Chrg: "200", Avg_Mdcr_Alowd_Amt: "120", Avg_Mdcr_Pymt_Amt: "95", Avg_Mdcr_Stdzd_Amt: "90" },
        { HCPCS_Cd: "99214", HCPCS_Desc: "Office visit", HCPCS_Drug_Ind: "N", Place_Of_Srvc: "F", Tot_Srvcs: "10", Tot_Benes: "9", Avg_Sbmtd_Chrg: "200", Avg_Mdcr_Alowd_Amt: "100", Avg_Mdcr_Pymt_Amt: "80", Avg_Mdcr_Stdzd_Amt: "78" },
        { HCPCS_Cd: "J2777", HCPCS_Desc: "Faricimab", HCPCS_Drug_Ind: "Y", Place_Of_Srvc: "O", Tot_Srvcs: "50", Tot_Benes: "5", Avg_Sbmtd_Chrg: "300", Avg_Mdcr_Alowd_Amt: "250", Avg_Mdcr_Pymt_Amt: "200", Avg_Mdcr_Stdzd_Amt: "200" },
      ],
      2024,
      "id"
    );
    const visit = year.services.find((s) => s.code === "99214")!;
    expect(visit.services).toBe(110);
    expect(visit.medicarePayment).toBe(95 * 100 + 80 * 10);
    expect(visit.facilityPayment).toBe(800);
    expect(visit.isDrug).toBe(false);
    expect(year.services.find((s) => s.code === "J2777")?.isDrug).toBe(true);
  });
});

describe("buildRbcsMap", () => {
  it("keeps only each code's latest category assignment", () => {
    const map = buildRbcsMap([
      { HCPCS_Cd: "0001A", RBCS_Cat_Desc: "Treatment", RBCS_Subcat_Desc: "COVID-era", RBCS_Latest_Assignment: "0" },
      { HCPCS_Cd: "0001A", RBCS_Cat_Desc: "Treatment", RBCS_Subcat_Desc: "Injections and Infusions (nononcologic)", RBCS_Latest_Assignment: "1" },
    ]);
    expect(map["0001A"].subcategory).toBe("Injections and Infusions (nononcologic)");
  });
});

describe("committed service summaries", () => {
  it("round-trip from compact storage with descriptions restored", () => {
    const years = loadAllServiceYears();
    expect(years.length).toBeGreaterThanOrEqual(2);
    const latest = years[years.length - 1];
    const visit = latest.services.find((s) => s.code === "99214");
    expect(visit?.description).toMatch(/office/i);
    expect(visit?.medicarePayment).toBeGreaterThan(1e9);
  });
});
