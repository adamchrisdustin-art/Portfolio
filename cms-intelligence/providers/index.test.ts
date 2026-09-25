import { describe, expect, it } from "vitest";
import { createProviderFromSpec } from "./index";

describe("createProviderFromSpec", () => {
  it("builds the named provider and model when that provider's key is set", () => {
    expect(createProviderFromSpec("openai:gpt-6-luna", { OPENAI_API_KEY: "k" })?.name).toBe("openai:gpt-6-luna");
    expect(createProviderFromSpec("anthropic:claude-sonnet-5", { ANTHROPIC_API_KEY: "k" })?.name).toBe("anthropic:claude-sonnet-5");
  });

  it("returns null, never throws, when the key is missing or the spec is malformed", () => {
    expect(createProviderFromSpec("anthropic:claude-sonnet-5", { OPENAI_API_KEY: "k" })).toBeNull();
    expect(createProviderFromSpec("claude-sonnet-5", { ANTHROPIC_API_KEY: "k" })).toBeNull();
    expect(createProviderFromSpec("", { ANTHROPIC_API_KEY: "k" })).toBeNull();
    expect(createProviderFromSpec(undefined, { ANTHROPIC_API_KEY: "k" })).toBeNull();
  });
});
