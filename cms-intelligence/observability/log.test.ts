import { describe, expect, it, vi } from "vitest";
import { logAgentRun } from "./log";

describe("logAgentRun", () => {
  it("emits a single JSON line with the full record shape", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logAgentRun({
      taskId: "sweep-1:market-growth",
      agentId: "market-growth-geographic-intelligence",
      provider: "anthropic",
      model: null,
      latencyMs: 42,
      dataSourcesUsed: ["cms:hospital-general-information"],
      success: true,
      validationResult: "passed",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      event: "agent-run",
      taskId: "sweep-1:market-growth",
      agentId: "market-growth-geographic-intelligence",
      provider: "anthropic",
      model: null,
      latencyMs: 42,
      success: true,
      validationResult: "passed",
    });
    expect(parsed.dataSourcesUsed).toEqual(["cms:hospital-general-information"]);
    spy.mockRestore();
  });

  it("never throws, even if console.log itself fails", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("stdout closed");
    });
    expect(() =>
      logAgentRun({
        taskId: "sweep-1:provider-network",
        agentId: "provider-network-intelligence",
        provider: null,
        model: null,
        latencyMs: 0,
        dataSourcesUsed: [],
        success: false,
        validationResult: "failed-other",
      })
    ).not.toThrow();
    spy.mockRestore();
  });
});
