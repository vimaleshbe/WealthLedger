import { afterEach, describe, expect, it, vi } from "vitest";
import { isCashMovementDate } from "./utils";

describe("isCashMovementDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats today and yesterday as live transactions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 10, 0, 0));

    expect(isCashMovementDate("2026-11-13")).toBe(true);
    expect(isCashMovementDate("2026-11-12")).toBe(true);
  });

  it("treats older dates as backfilled history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 10, 0, 0));

    expect(isCashMovementDate("2026-11-11")).toBe(false);
    expect(isCashMovementDate("2025-01-01")).toBe(false);
  });

  it("handles month and year boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0));

    expect(isCashMovementDate("2025-12-31")).toBe(true);
    expect(isCashMovementDate("2025-12-30")).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(isCashMovementDate("")).toBe(false);
    expect(isCashMovementDate("not-a-date")).toBe(false);
  });
});
