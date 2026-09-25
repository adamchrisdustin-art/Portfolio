import { describe, expect, it } from "vitest";
import { ruralityOf, summarizeRows } from "./physicianByProviderSummary";

const row = (overrides: Record<string, string>) => ({
  Rndrng_NPI: "1000000000",
  Rndrng_Prvdr_Last_Org_Name: "Example",
  Rndrng_Prvdr_Ent_Cd: "I",
  Rndrng_Prvdr_Type: "Cardiology",
  Rndrng_Prvdr_State_Abrvtn: "WA",
  Rndrng_Prvdr_RUCA: "1",
  Tot_Benes: "100",
  Tot_Srvcs: "200",
  Tot_Sbmtd_Chrg: "1000",
  Tot_Mdcr_Alowd_Amt: "500",
  Tot_Mdcr_Pymt_Amt: "400",
  Tot_Mdcr_Stdzd_Amt: "450",
  Bene_Avg_Risk_Scre: "1.5",
  ...overrides,
});

describe("ruralityOf", () => {
  it("maps CMS RUCA codes to metropolitan / micropolitan / small-town-rural", () => {
    expect(ruralityOf("1")).toBe("metropolitan");
    expect(ruralityOf("3.2")).toBe("metropolitan");
    expect(ruralityOf("5")).toBe("micropolitan");
    expect(ruralityOf("10")).toBe("small-town-rural");
    expect(ruralityOf("99")).toBe("unknown");
    expect(ruralityOf("")).toBe("unknown");
  });
});

describe("summarizeRows", () => {
  it("counts every provider into state x type and state x rurality totals", () => {
    const summary = summarizeRows(
      [
        row({ Rndrng_NPI: "1" }),
        row({ Rndrng_NPI: "2", Tot_Benes: "300", Tot_Mdcr_Pymt_Amt: "600", Bene_Avg_Risk_Scre: "2.5", Rndrng_Prvdr_RUCA: "8" }),
        row({ Rndrng_NPI: "3", Rndrng_Prvdr_State_Abrvtn: "OR" }),
      ],
      2024,
      "id-2024",
      "2026-09-25T00:00:00Z"
    );
    expect(summary.providerCount).toBe(3);
    const waCardiology = summary.byStateType.find((r) => r.state === "WA" && r.providerType === "Cardiology")!;
    expect(waCardiology.providers).toBe(2);
    expect(waCardiology.medicarePayment).toBe(1000);
    expect(waCardiology.beneficiaryProviderPairs).toBe(400);
    // Beneficiary-weighted: (1.5*100 + 2.5*300) / 400 = 2.25
    expect(waCardiology.avgRiskScore).toBe(2.25);
    expect(summary.byStateRurality.find((r) => r.state === "WA" && r.rurality === "small-town-rural")?.providers).toBe(1);
  });

  it("treats blank or suppressed numbers as zero and leaves the risk score null when none was reported", () => {
    const summary = summarizeRows([row({ Tot_Srvcs: "", Bene_Avg_Risk_Scre: "" })], 2024, "id", "t");
    expect(summary.byStateType[0].services).toBe(0);
    expect(summary.byStateType[0].avgRiskScore).toBeNull();
  });

  it("keeps the top providers by Medicare payment, highest first", () => {
    const rows = Array.from({ length: 150 }, (_, i) => row({ Rndrng_NPI: String(i), Tot_Mdcr_Pymt_Amt: String(i) }));
    const { topProviders } = summarizeRows(rows, 2024, "id", "t");
    expect(topProviders).toHaveLength(100);
    expect(topProviders[0].npi).toBe("149");
    expect(topProviders[99].npi).toBe("50");
  });
});
