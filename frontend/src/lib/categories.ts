import type { Category } from "../types";

/** Tailwind classes for category badges. Kept in one place so pages stay consistent. */
export const CATEGORY_BADGE: Record<Category, string> = {
  equity: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  debt: "border-transparent bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300",
  retirement:
    "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  cash: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  real_estate:
    "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  commodities:
    "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

/** Hex colours used by the allocation chart, keyed by category. */
export const CATEGORY_HEX: Record<string, string> = {
  equity: "#4f46e5",
  debt: "#0891b2",
  retirement: "#f59e0b",
  cash: "#10b981",
  real_estate: "#8b5cf6",
  commodities: "#f43f5e",
};

export const CATEGORY_LABEL: Record<string, string> = {
  equity: "Equity",
  debt: "Debt",
  retirement: "Retirement",
  cash: "Cash",
  real_estate: "Real Estate",
  commodities: "Commodities",
};

export function formatCategory(value?: string | null): string {
  if (!value) return "Other";
  return CATEGORY_LABEL[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function categoryColor(value?: string | null): string {
  return CATEGORY_HEX[value ?? ""] ?? "#64748b";
}

export function categoryBadgeClass(value?: string | null): string {
  return CATEGORY_BADGE[(value as Category) ?? "equity"] ?? CATEGORY_BADGE.equity;
}
