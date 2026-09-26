import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { changedSources, currentFingerprints, fingerprintSnapshot, latestPullDate, SOURCE_ID_BY_DATASET } from "./sourceFingerprints";

describe("fingerprintSnapshot", () => {
  it("ignores the pull timestamp, so an unchanged re-pull fingerprints identically", () => {
    const a = fingerprintSnapshot({ pulledAt: "2026-09-01T13:00:00Z", rows: [{ id: 1 }] });
    const b = fingerprintSnapshot({ pulledAt: "2026-10-01T13:00:00Z", rows: [{ id: 1 }] });
    expect(a).toBe(b);
  });

  it("changes when the real content changes", () => {
    const a = fingerprintSnapshot({ pulledAt: "x", rows: [{ id: 1 }] });
    const b = fingerprintSnapshot({ pulledAt: "x", rows: [{ id: 2 }] });
    expect(a).not.toBe(b);
  });
});

describe("changedSources", () => {
  it("treats every source as changed when there is no previous run", () => {
    expect(changedSources(null, { b: "2", a: "1" })).toEqual(["a", "b"]);
  });

  it("reports only sources whose content moved", () => {
    expect(changedSources({ a: "1", b: "2" }, { a: "1", b: "3", c: "4" })).toEqual(["b", "c"]);
  });
});

describe("currentFingerprints", () => {
  it("covers every real committed source, including hospital data under data/cms", () => {
    const fingerprints = currentFingerprints();
    expect(Object.keys(fingerprints)).toContain("hospital-general-information");
    expect(Object.keys(fingerprints)).toContain("home-health-care-agencies");
    expect(Object.keys(fingerprints).length).toBeGreaterThanOrEqual(10);
  });

  it("maps every fingerprinted dataset to a real source id, so 'new this cycle' tagging can't silently miss one", () => {
    for (const dataset of Object.keys(currentFingerprints())) {
      if (dataset === "evaluation-runs" || dataset === "reasoned") continue;
      expect(SOURCE_ID_BY_DATASET[dataset], dataset).toBeDefined();
    }
  });
});

describe("latestPullDate", () => {
  it("returns the newest snapshot date across sources, ignoring other files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulls-"));
    const a = path.join(root, "a");
    const b = path.join(root, "b");
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    for (const [dir, file] of [[a, "2026-08-01.json"], [a, "2026-09-01.json"], [b, "2026-09-25.json"], [b, "notes.json"]]) fs.writeFileSync(path.join(dir, file), "{}");
    expect(latestPullDate({ a, b })).toBe("2026-09-25");
    expect(latestPullDate({})).toBeNull();
  });
});
