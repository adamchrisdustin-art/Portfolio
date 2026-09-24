import { describe, expect, it } from "vitest";
import { questionNumberFrom, routeQuestion, routeQuestions } from "./routing";

describe("questionNumberFrom", () => {
  it("extracts the number from a well-formed question ID", () => {
    expect(questionNumberFrom("Q001")).toBe(1);
    expect(questionNumberFrom("Q112")).toBe(112);
  });

  it("throws on a malformed question ID", () => {
    expect(() => questionNumberFrom("QABC")).toThrow(/Malformed question ID/);
    expect(() => questionNumberFrom("12")).toThrow(/Malformed question ID/);
  });
});

describe("routeQuestion", () => {
  it("routes a question to its owning agent at each range boundary", () => {
    expect(routeQuestion("Q001")).toBe("market-growth-geographic-intelligence");
    expect(routeQuestion("Q010")).toBe("market-growth-geographic-intelligence");
    expect(routeQuestion("Q011")).toBe("claims-utilization-cost-intelligence");
    expect(routeQuestion("Q025")).toBe("claims-utilization-cost-intelligence");
    expect(routeQuestion("Q026")).toBe("reimbursement-payment-intelligence");
  });

  it("routes jointly-owned pharmacy questions (Q096-101) to Medicare Advantage/Part D", () => {
    expect(routeQuestion("Q096")).toBe("medicare-advantage-part-d-intelligence");
    expect(routeQuestion("Q101")).toBe("medicare-advantage-part-d-intelligence");
  });

  it("routes jointly-owned value-based-care questions (Q102-107) to Provider & Network", () => {
    expect(routeQuestion("Q102")).toBe("provider-network-intelligence");
    expect(routeQuestion("Q107")).toBe("provider-network-intelligence");
  });

  it("returns null for orchestrator-only Executive Strategy questions (Q108-112)", () => {
    expect(routeQuestion("Q108")).toBeNull();
    expect(routeQuestion("Q112")).toBeNull();
  });

  it("routes Market/Catalyst Intelligence questions (Q113-124) at each range boundary", () => {
    expect(routeQuestion("Q113")).toBe("market-catalyst-intelligence");
    expect(routeQuestion("Q124")).toBe("market-catalyst-intelligence");
  });

  it("routes hospital star-rating/quality-outcome questions (Q125-128) to Provider & Network at each range boundary", () => {
    expect(routeQuestion("Q125")).toBe("provider-network-intelligence");
    expect(routeQuestion("Q128")).toBe("provider-network-intelligence");
  });

  it("routes Q129 (NIH research-theme frequency) to Market/Catalyst Intelligence despite Q125-128 sitting in between", () => {
    expect(routeQuestion("Q129")).toBe("market-catalyst-intelligence");
  });

  it("returns null for a question number outside every defined range", () => {
    expect(routeQuestion("Q999")).toBeNull();
    expect(routeQuestion("Q130")).toBeNull();
  });
});

describe("routeQuestions", () => {
  it("returns the distinct set of owning agents for a mixed batch", () => {
    const agentIds = routeQuestions(["Q001", "Q005", "Q011", "Q108"]);
    expect(agentIds).toEqual(
      expect.arrayContaining(["market-growth-geographic-intelligence", "claims-utilization-cost-intelligence"])
    );
    expect(agentIds).toHaveLength(2);
  });

  it("returns an empty array when nothing routes", () => {
    expect(routeQuestions(["Q108", "Q109"])).toEqual([]);
  });
});
