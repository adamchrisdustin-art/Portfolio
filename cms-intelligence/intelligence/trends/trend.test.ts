import { describe, expect, it } from "vitest";
import { classifyConfidence, directionOf, isAnomaly, isSuppressed, meetsPersistence } from "./trend";

describe("isSuppressed", () => {
  it("flags counts below the CMS small-cell floor", () => {
    expect(isSuppressed(5)).toBe(true);
    expect(isSuppressed(11)).toBe(false);
    expect(isSuppressed(50)).toBe(false);
  });
});

describe("isAnomaly", () => {
  it("flags values more than 2x spread from the rolling mean", () => {
    expect(isAnomaly(120, 100, 5)).toBe(true); // 20 away, 2*5=10 threshold
    expect(isAnomaly(105, 100, 5)).toBe(false); // 5 away, within threshold
  });
  it("never flags an anomaly when spread is zero (no variance signal)", () => {
    expect(isAnomaly(150, 100, 0)).toBe(false);
  });
});

describe("directionOf / meetsPersistence", () => {
  it("requires 2 consecutive matching non-flat directions", () => {
    expect(meetsPersistence(["up", "up"])).toBe(true);
    expect(meetsPersistence(["down", "up"])).toBe(false);
    expect(meetsPersistence(["flat", "flat"])).toBe(false);
    expect(meetsPersistence(["up"])).toBe(false);
  });
  it("derives direction correctly", () => {
    expect(directionOf(110, 100)).toBe("up");
    expect(directionOf(90, 100)).toBe("down");
    expect(directionOf(100, 100)).toBe("flat");
  });
});

describe("classifyConfidence", () => {
  it("returns high only when persistence + baseline + corroboration all hold", () => {
    expect(
      classifyConfidence({ persistenceMet: true, hasFullBaseline: true, hasExternalCorroboration: true }).level
    ).toBe("high");
  });
  it("returns medium when corroboration is missing", () => {
    expect(
      classifyConfidence({ persistenceMet: true, hasFullBaseline: true, hasExternalCorroboration: false }).level
    ).toBe("medium");
  });
  it("returns low when persistence hasn't been met yet", () => {
    const result = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: true });
    expect(result.level).toBe("low");
    expect(result.rationale).toMatch(/persistence/);
  });
});
