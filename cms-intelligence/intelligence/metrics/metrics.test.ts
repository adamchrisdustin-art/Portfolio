import { describe, expect, it } from "vitest";
import { acceleration, concentrationRatio, growthRate, mixShare, pearsonCorrelation, penetration, pmpm, quartiles, tukeyBox, utilizationPer1000 } from "./metrics";

describe("growthRate", () => {
  it("computes percent growth", () => {
    expect(growthRate(110, 100)).toBeCloseTo(10);
    expect(growthRate(90, 100)).toBeCloseTo(-10);
  });
  it("rejects a zero prior value", () => {
    expect(() => growthRate(10, 0)).toThrow();
  });
});

describe("acceleration", () => {
  it("is the delta between two growth rates", () => {
    expect(acceleration(15, 10)).toBeCloseTo(5);
  });
});

describe("utilizationPer1000", () => {
  it("scales service count to a per-1000 rate", () => {
    expect(utilizationPer1000(250, 100000)).toBeCloseTo(2.5);
  });
  it("rejects a zero population", () => {
    expect(() => utilizationPer1000(10, 0)).toThrow();
  });
});

describe("penetration", () => {
  it("computes enrolled/eligible as a percent", () => {
    expect(penetration(4000, 10000)).toBeCloseTo(40);
  });
});

describe("concentrationRatio", () => {
  it("sums the top N values over total", () => {
    // top 2 of [50, 30, 15, 5] over total 100 = 80%
    expect(concentrationRatio([50, 30, 15, 5], 2, 100)).toBeCloseTo(80);
  });
});

describe("pmpm", () => {
  it("divides total cost by member-months, not member count", () => {
    expect(pmpm(12000, 1000)).toBeCloseTo(12);
  });
});

describe("mixShare", () => {
  it("computes a category's share of total", () => {
    expect(mixShare(25, 100)).toBeCloseTo(25);
  });
});

describe("quartiles", () => {
  it("computes q1/median/q3 via linear interpolation on a sorted sample", () => {
    const q = quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(q.median).toBeCloseTo(5);
    expect(q.q1).toBeCloseTo(3);
    expect(q.q3).toBeCloseTo(7);
  });
});

describe("pearsonCorrelation", () => {
  it("is 1 for a perfect positive linear relationship", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
  });

  it("is -1 for a perfect negative linear relationship", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
  });

  it("is 0, not NaN, when one series has zero variance", () => {
    expect(pearsonCorrelation([1, 2, 3], [5, 5, 5])).toBe(0);
  });

  it("rejects mismatched or empty input lengths", () => {
    expect(() => pearsonCorrelation([1, 2], [1])).toThrow();
    expect(() => pearsonCorrelation([], [])).toThrow();
  });
});

describe("tukeyBox", () => {
  it("whiskers stay within the true sample range and are correctly ordered", () => {
    const box = tukeyBox([10, 12, 13, 14, 15, 16, 17, 18, 20]);
    expect(box.whiskerLow).toBeLessThanOrEqual(box.q1);
    expect(box.q3).toBeLessThanOrEqual(box.whiskerHigh);
    expect(box.sampleSize).toBe(9);
  });

  it("keeps a genuine outlier out of the whiskers and reports it separately, never discarding it", () => {
    const box = tukeyBox([10, 11, 12, 11, 10, 12, 11, 10, 500]);
    expect(box.outliers).toContain(500);
    expect(box.whiskerHigh).toBeLessThan(500);
  });

  it("every outlier genuinely falls outside the whisker range", () => {
    const box = tukeyBox([5, 6, 7, 8, 9, 10, 11, 100, -50]);
    for (const v of box.outliers) {
      expect(v < box.whiskerLow || v > box.whiskerHigh).toBe(true);
    }
  });
});
