import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnthropicProvider } from "./anthropic";

function captureRequestBody(): { body: () => Record<string, unknown> } {
  let sent: Record<string, unknown> = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      sent = JSON.parse(init.body);
      return { ok: true, json: async () => ({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }) };
    })
  );
  return { body: () => sent };
}

afterEach(() => vi.unstubAllGlobals());

describe("createAnthropicProvider effort", () => {
  it("sends output_config.effort to models that think by default", async () => {
    const req = captureRequestBody();
    await createAnthropicProvider("k", "claude-sonnet-5").generate({ system: "s", user: "u", effort: "low" });
    expect(req.body().output_config).toEqual({ effort: "low" });
  });

  it("never sends effort to Haiku 4.5, which rejects it with a 400", async () => {
    const req = captureRequestBody();
    await createAnthropicProvider("k", "claude-haiku-4-5-20251001").generate({ system: "s", user: "u", effort: "low" });
    expect(req.body().output_config).toBeUndefined();
  });

  it("sends no effort field when the caller doesn't ask for one", async () => {
    const req = captureRequestBody();
    await createAnthropicProvider("k", "claude-opus-5-5").generate({ system: "s", user: "u" });
    expect(req.body().output_config).toBeUndefined();
  });
});
