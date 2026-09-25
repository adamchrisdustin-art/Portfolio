import { describe, expect, it } from "vitest";
import { summarizeNihRecords, type SummaryRecord } from "./nihReporterAwards";

const record = (id: number, overrides: Partial<SummaryRecord> = {}): SummaryRecord => ({
  appl_id: id,
  award_amount: 1000,
  award_notice_date: "2026-08-04T00:00:00",
  activity_code: "R01",
  funding_mechanism: "Non-SBIR/STTR",
  organization: { org_state: "WA" },
  agency_ic_admin: { abbreviation: "NCI" },
  ...overrides,
});

describe("summarizeNihRecords", () => {
  const summary = summarizeNihRecords(
    [
      record(1),
      record(2, { award_amount: 3000, agency_ic_admin: { abbreviation: "NIAID" } }),
      record(3, { award_notice_date: "2026-07-15T00:00:00", organization: { org_state: "CA" } }),
      record(4, { award_amount: null, activity_code: null }),
    ],
    4
  );

  it("totals every notice and dollar, counting a missing amount as $0 and recording it", () => {
    expect(summary.notices).toBe(4);
    expect(summary.dollars).toBe(5000);
    expect(summary.reportedTotal).toBe(4);
    expect(summary.missingAmount).toBe(1);
  });

  it("breaks totals out by month, month x institute, state and award type", () => {
    expect(summary.byMonth).toEqual([
      { month: "2026-07", notices: 1, dollars: 1000 },
      { month: "2026-08", notices: 3, dollars: 4000 },
    ]);
    expect(summary.byMonthInstitute).toContainEqual({ month: "2026-08", institute: "NIAID", notices: 1, dollars: 3000 });
    expect(summary.byState).toContainEqual({ state: "CA", notices: 1, dollars: 1000 });
    expect(summary.byActivityCode).toContainEqual({ activityCode: "unknown", notices: 1, dollars: 0 });
    expect(summary.byFundingMechanism).toEqual([{ mechanism: "Non-SBIR/STTR", notices: 4, dollars: 5000 }]);
  });
});
