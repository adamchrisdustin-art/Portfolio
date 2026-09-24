import { describe, expect, it } from "vitest";
import { assessSnapshotHistory, dateFromSnapshotFilename, directionsAcrossSnapshots } from "./snapshotHistory";

describe("assessSnapshotHistory", () => {
  it("computes days of history and full-baseline status for a short real history", () => {
    const result = assessSnapshotHistory(["2026-09-16", "2026-09-21", "2026-09-23"]);
    expect(result.snapshotCount).toBe(3);
    expect(result.earliestDate).toBe("2026-09-16");
    expect(result.latestDate).toBe("2026-09-23");
    expect(result.daysOfHistory).toBe(7);
    expect(result.hasFullBaseline).toBe(false); // nowhere near 730 days yet
  });

  it("recognizes a full 24-month baseline once enough real history exists", () => {
    const result = assessSnapshotHistory(["2024-01-01", "2026-09-23"]);
    expect(result.hasFullBaseline).toBe(true);
  });

  it("collapses duplicate dates", () => {
    expect(assessSnapshotHistory(["2026-09-23", "2026-09-23"]).snapshotCount).toBe(1);
  });

  it("throws on an empty list rather than silently returning a bogus result", () => {
    expect(() => assessSnapshotHistory([])).toThrow();
  });
});

describe("directionsAcrossSnapshots", () => {
  it("returns flat when a metric hasn't changed across real snapshots", () => {
    expect(directionsAcrossSnapshots([5419, 5419, 5419])).toEqual(["flat", "flat"]);
  });
  it("detects a real upward move", () => {
    expect(directionsAcrossSnapshots([100, 105])).toEqual(["up"]);
  });
});

describe("dateFromSnapshotFilename", () => {
  it("extracts the date stamp from a snapshot path", () => {
    expect(dateFromSnapshotFilename("C:\\data\\snapshots\\2026-09-23.json")).toBe("2026-09-23");
  });
  it("throws on a filename with no date stamp", () => {
    expect(() => dateFromSnapshotFilename("not-a-date.json")).toThrow();
  });
});
