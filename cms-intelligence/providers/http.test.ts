import { afterEach, describe, expect, it, vi } from "vitest";
import { postJson } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("postJson", () => {
  it("returns the parsed body on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) })));
    expect(await postJson("test", "https://x", {}, {})).toEqual({ a: 1 });
  });

  it("logs the provider's own error message on a failed status, and returns null", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"error":{"message":"Missing scopes: api.responses.write"}}' })));
    expect(await postJson("test", "https://x", {}, {})).toBeNull();
    expect(error.mock.calls[0][0]).toMatch(/401 Unauthorized - .*Missing scopes/);
  });

  it("logs the underlying error code when the request throws, and returns null", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_HEADERS_TIMEOUT" } }); }));
    expect(await postJson("test", "https://x", {}, {})).toBeNull();
    expect(error.mock.calls[0][0]).toMatch(/fetch failed \(UND_ERR_HEADERS_TIMEOUT\)/);
  });
});
