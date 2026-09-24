import { describe, expect, it } from "vitest";
import { acceleration, concentrationRatio, growthRate, mixShare, penetration, pmpm, utilizationPer1000 } from "./metrics";

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
