import { describe, expect, it } from "vitest";
import { checkGrounding, ungroundedCarrierNames, ungroundedNumbers } from "./grounding";

const SOURCE = "Mean spending ratio 0.9712 across 8,603 agencies; Alabama 330 episodes/agency; payment 0.23 of charge; median $412.50; Humana leads enrollment.";

describe("ungroundedNumbers", () => {
  it("accepts numbers copied exactly, including commas, currency and rounding to fewer decimals", () => {
    expect(ungroundedNumbers("Ratio 0.97 over 8,603 agencies, 330 per agency, median $412.50.", SOURCE)).toEqual([]);
  });

  it("accepts a fraction restated as a percentage", () => {
    expect(ungroundedNumbers("Medicare pays 23% of charges.", SOURCE)).toEqual([]);
  });

  it("flags a number that appears nowhere in the source", () => {
    expect(ungroundedNumbers("Spending rose 14% to 9,120 agencies.", SOURCE)).toEqual(["14%", "9,120"]);
  });

  it("ignores small counts and ordinals", () => {
    expect(ungroundedNumbers("The top 3 findings across 2 agents.", SOURCE)).toEqual([]);
  });

  it("rejects unit conversions rather than guessing they're equivalent", () => {
    expect(ungroundedNumbers("About 8.6 thousand agencies.", SOURCE)).toEqual(["8.6"]);
  });
});

describe("ungroundedCarrierNames", () => {
  it("allows a carrier name that appears in the real facts", () => {
    expect(ungroundedCarrierNames("Humana remains the leader.", SOURCE)).toEqual([]);
  });

  it("flags a carrier name the facts never mention", () => {
    expect(ungroundedCarrierNames("Aetna is likely affected.", SOURCE)).toEqual(["Aetna"]);
  });
});

describe("checkGrounding", () => {
  it("is grounded only when both numbers and names trace to the source", () => {
    expect(checkGrounding("Humana leads; ratio 0.97.", SOURCE).grounded).toBe(true);
    expect(checkGrounding("Cigna leads; ratio 0.97.", SOURCE).grounded).toBe(false);
  });
});
