import { describe, expect, it } from "vitest";
import {
  asPFComponents,
  isMatured,
  latestInterestDate,
  pfComponentsTotal,
} from "./retirement";

describe("asPFComponents", () => {
  it("reads the three passbook amounts", () => {
    expect(
      asPFComponents({
        employee_share: 14_922,
        employer_share: 13_672,
        pension_share: 1_250,
      }),
    ).toEqual({
      employee_share: 14_922,
      employer_share: 13_672,
      pension_share: 1_250,
    });
  });

  it("keeps totals from the older employer-EPF and VPF keys", () => {
    expect(
      asPFComponents({
        employee_share: 6_000,
        vpf: 500,
        employer_epf_share: 4_750,
        pension_share: 1_250,
      }),
    ).toEqual({
      employee_share: 6_500,
      employer_share: 4_750,
      pension_share: 1_250,
    });
  });

  it("handles missing details", () => {
    expect(asPFComponents(null)).toEqual({
      employee_share: 0,
      employer_share: 0,
      pension_share: 0,
    });
  });
});

describe("pfComponentsTotal", () => {
  it("adds employee, employer and pension", () => {
    expect(
      pfComponentsTotal({
        employee_share: 14_922,
        employer_share: 13_284,
        pension_share: 1_638,
      }),
    ).toBe(29_844);
  });
});

describe("latestInterestDate", () => {
  it("uses the current year's 31 March after the credit date", () => {
    expect(latestInterestDate("2026-11-13")).toBe("2026-03-31");
    expect(latestInterestDate("2026-04-01")).toBe("2026-03-31");
  });

  it("uses 31 March itself on the credit date", () => {
    expect(latestInterestDate("2026-03-31")).toBe("2026-03-31");
  });

  it("rolls back to the previous year before 31 March", () => {
    expect(latestInterestDate("2026-03-30")).toBe("2025-03-31");
    expect(latestInterestDate("2026-01-15")).toBe("2025-03-31");
  });
});

describe("isMatured", () => {
  it("compares the maturity date with today", () => {
    expect(isMatured("2039-04-01", "2039-03-31")).toBe(false);
    expect(isMatured("2039-04-01", "2039-04-01")).toBe(true);
    expect(isMatured("2039-04-01", "2040-01-01")).toBe(true);
    expect(isMatured(null, "2040-01-01")).toBe(false);
  });
});
