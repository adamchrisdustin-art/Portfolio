import { describe, expect, it } from "vitest";
import { findOutliers, median, MIN_GROUP_SIZE } from "./outliers";

const group = (values: number[]) => values.map((value, i) => ({ id: `S${i}`, label: `State ${i}`, value }));

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("findOutliers", () => {
  it("flags a member far above the rest, and none of the ordinary spread", () => {
    const result = findOutliers(group([10, 11, 9, 10, 12, 8, 10, 11, 9, 10, 40]))!;
    expect(result.groupSize).toBe(11);
    expect(result.median).toBe(10);
    expect(result.outliers.map((o) => o.id)).toEqual(["S10"]);
    expect(result.outliers[0].direction).toBe("above");
    expect(result.outliers[0].modifiedZ).toBeGreaterThan(3.5);
  });

  it("flags members below as well, most extreme first", () => {
    const result = findOutliers(group([10, 11, 9, 10, 12, 8, 10, 11, 9, 10, -20, 30]))!;
    expect(result.outliers.map((o) => [o.id, o.direction])).toEqual([
      ["S10", "below"],
      ["S11", "above"],
    ]);
  });

  it("is not fooled by an extreme value inflating the spread, as a mean and standard deviation would be", () => {
    // With mean/SD, 1000 inflates the SD enough that 60 looks ordinary; median/MAD still flags both.
    const result = findOutliers(group([10, 11, 9, 10, 12, 8, 10, 11, 9, 10, 60, 1000]))!;
    expect(result.outliers.map((o) => o.id).sort()).toEqual(["S10", "S11"]);
  });

  it("returns null for a group too small to judge", () => {
    expect(findOutliers(group(Array.from({ length: MIN_GROUP_SIZE - 1 }, (_, i) => i)))).toBeNull();
  });

  it("returns null when most members are identical (no spread to judge against)", () => {
    expect(findOutliers(group([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 9]))).toBeNull();
  });

  it("ignores non-finite values", () => {
    const result = findOutliers(group([10, 11, 9, 10, 12, 8, 10, 11, 9, 10, NaN, Infinity]))!;
    expect(result.groupSize).toBe(10);
  });
});
