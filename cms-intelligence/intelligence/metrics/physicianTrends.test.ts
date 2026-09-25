import { describe, expect, it } from "vitest";
import type { PhysicianYearData, StateTypeRow } from "../../data/adapters/physicianByProviderSummary";
import { byState, cagr, checkAgainstHistory, decompose, isSplitReliable, nationalByProviderType, nationalTotals } from "./physicianTrends";

const row = (state: string, providerType: string, medicarePayment: number, services: number, providers = 20): StateTypeRow => ({
  state,
  providerType,
  providers,
  beneficiaryProviderPairs: 0,
  services,
  submittedCharges: medicarePayment * 4,
  allowedAmount: medicarePayment * 1.25,
  medicarePayment,
  standardizedPayment: medicarePayment,
  avgRiskScore: null,
});

const year = (dataYear: number, rows: StateTypeRow[]): PhysicianYearData => ({
  dataset: "test",
  dataYear,
  datasetId: "id",
  providerCount: rows.reduce((s, r) => s + r.providers, 0),
  byStateType: rows,
  byStateRurality: [],
  topProviders: [],
});

describe("roll-ups", () => {
  const y = year(2024, [row("WA", "Cardiology", 100, 10), row("OR", "Cardiology", 50, 5), row("GU", "Cardiology", 7, 1)]);

  it("sums every row nationally, including territories", () => {
    expect(nationalTotals(y).medicarePayment).toBe(157);
    expect(nationalByProviderType(y).get("Cardiology")?.providers).toBe(60);
  });

  it("limits state comparisons to the 50 states and DC", () => {
    expect([...byState(y).keys()].sort()).toEqual(["OR", "WA"]);
  });
});

describe("decompose", () => {
  it("splits payment growth into volume and payment per service", () => {
    // Services +10%, payment per service +20% -> payment +32%.
    const split = decompose(row("WA", "X", 132, 110), row("WA", "X", 100, 100))!;
    expect(split.payment).toBeCloseTo(0.32);
    expect(split.volume).toBeCloseTo(0.1);
    expect(split.price).toBeCloseTo(0.2);
    expect((1 + split.volume) * (1 + split.price)).toBeCloseTo(1 + split.payment);
  });

  it("marks a split unreliable when volume and price swing hard in opposite directions (a service-counting change)", () => {
    expect(isSplitReliable({ payment: 0.129, volume: 1.386, price: -0.527 })).toBe(false);
    expect(isSplitReliable({ payment: 0.355, volume: 0.311, price: 0.034 })).toBe(true);
    expect(isSplitReliable({ payment: 0.02, volume: 0.3, price: 0.1 })).toBe(true);
  });

  it("refuses to compare groups under the 11-provider floor", () => {
    expect(decompose(row("WA", "X", 132, 110, 5), row("WA", "X", 100, 100, 5))).toBeNull();
  });
});

describe("checkAgainstHistory", () => {
  it("flags a latest year that breaks from steady history", () => {
    // Six years of ~2% growth, then +15%.
    const check = checkAgainstHistory([100, 102, 104, 106.2, 108.3, 110.4, 112.7, 129.6])!;
    expect(check.historyChanges).toBe(6);
    expect(check.anomalous).toBe(true);
  });

  it("does not flag a latest year in line with its history", () => {
    const check = checkAgainstHistory([100, 102, 104.5, 106.2, 108.7, 110.4, 112.9, 115.1])!;
    expect(check.anomalous).toBe(false);
  });

  it("stays unjudged with too little history", () => {
    expect(checkAgainstHistory([100, 102, 104, 106])).toBeNull();
  });

  it("does not flag a tiny deviation from a very steady history", () => {
    // Growth of exactly 2% every year, then 2.2%: beyond 2 MADs of a near-zero MAD, but under the 1-point floor.
    const check = checkAgainstHistory([100, 102, 104.04, 106.12, 108.24, 110.41, 112.62, 115.1])!;
    expect(check.anomalous).toBe(false);
  });

  it("resists a single shock year in the history, like 2020", () => {
    const check = checkAgainstHistory([100, 102, 104, 106, 90, 105, 107, 109.2])!;
    expect(check.anomalous).toBe(false);
  });
});

describe("cagr", () => {
  it("computes compound annual growth", () => {
    expect(cagr(121, 100, 2)).toBeCloseTo(0.1);
    expect(cagr(100, 0, 2)).toBeNull();
  });
});
