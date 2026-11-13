/** "12 months" → "1 year", "30 months" → "2y 6m". */
export function tenureLabel(months: number | null | undefined): string {
  if (!months || months <= 0) return "—";
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (remaining > 0) parts.push(`${remaining}m`);
  return parts.join(" ");
}

export function projectMaturityValue(
  principal: number,
  annualRate: number | null | undefined,
  months: number | null | undefined,
): number | null {
  if (!principal || principal <= 0) return null;
  if (annualRate === null || annualRate === undefined || annualRate < 0) return null;
  if (!months || months <= 0) return null;
  return principal * (1 + annualRate / 100) ** (months / 12);
}

/** Add months to an ISO date, clamping to the last valid day. */
export function addMonthsISO(dateISO: string, months: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const target = month + months;
  const targetYear = year + Math.floor(target / 12);
  const targetMonth = ((target % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(
    targetDay,
  ).padStart(2, "0")}`;
}

export function fdStatus(
  daysRemaining: number | null | undefined,
): "Matured" | "Active" | "Unknown" {
  if (daysRemaining === null || daysRemaining === undefined) return "Unknown";
  return daysRemaining <= 0 ? "Matured" : "Active";
}
