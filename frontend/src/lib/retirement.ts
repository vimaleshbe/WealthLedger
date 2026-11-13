export interface PFComponents {
  employee_share: number;
  employer_share: number;
  pension_share: number;
}

/** Read the three passbook amounts stored on a PF contribution entry. */
export function asPFComponents(
  details: Record<string, unknown> | null | undefined,
): PFComponents {
  const number = (value: unknown): number => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    employee_share:
      number(details?.employee_share) + number(details?.vpf),
    employer_share: number(
      details?.employer_share ?? details?.employer_epf_share,
    ),
    pension_share: number(details?.pension_share),
  };
}

export function pfComponentsTotal(components: PFComponents): number {
  return (
    components.employee_share +
    components.employer_share +
    components.pension_share
  );
}

/**
 * The latest PPF interest credit date. PPF interest is credited on 31 March
 * each year, so before that date the previous financial year's credit is the
 * most recent one.
 */
export function latestInterestDate(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  if (!year || !month || !day) return today;
  const interestYear =
    month > 3 || (month === 3 && day === 31) ? year : year - 1;
  return `${interestYear}-03-31`;
}

/** True when a PPF account has reached its maturity date. */
export function isMatured(
  maturityDate: string | null | undefined,
  today: string,
): boolean {
  return !!maturityDate && maturityDate <= today;
}
