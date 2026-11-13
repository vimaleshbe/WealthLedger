import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const currencyFormatterNoDecimals = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return currencyFormatter.format(safe === 0 ? 0 : safe);
}

export function formatCurrencyCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return currencyFormatterNoDecimals.format(safe === 0 ? 0 : safe);
}

/** Indian-style short currency: ₹71.31L, ₹1.24Cr, ₹8.5K. */
export function formatCompactCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? "-" : "";

  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** Shorter variant for chart axes: ₹80L, ₹1.2Cr. */
export function formatAxisCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    const scaled = abs / 1_00_00_000;
    return `${sign}₹${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}Cr`;
  }
  if (abs >= 1_00_000) {
    const scaled = abs / 1_00_000;
    return `${sign}₹${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}L`;
  }
  if (abs >= 1_000) {
    const scaled = abs / 1_000;
    return `${sign}₹${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}K`;
  }
  return `${sign}₹${abs.toFixed(0)}`;
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(
    safe === 0 ? 0 : safe,
  );
}

export function formatDate(value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").map(Number) : null;
  const date = dateOnly
    ? new Date(dateOnly[0], dateOnly[1] - 1, dateOnly[2])
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** Local date in YYYY-MM-DD without the UTC off-by-one issue. */
export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

/**
 * True when an entry dated `value` should move the cash balance.
 * Today and yesterday count as live transactions; anything older is
 * backfilled history and must not change cash.
 */
export function isCashMovementDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const now = new Date();
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const target = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return target >= yesterday;
}
