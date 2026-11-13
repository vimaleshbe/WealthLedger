import type { GoldPurity } from "../types";

export const GOLD_PURITIES: {
  value: GoldPurity;
  label: string;
  purityMark: string;
}[] = [
  { value: "22k", label: "22K", purityMark: "916" },
  { value: "24k", label: "24K", purityMark: "999" },
];

export function normalizeGoldPurity(value: unknown): GoldPurity {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(" ", "")
    .replace("kt", "k")
    .replace("carat", "k");

  if (["24", "24k", "999"].includes(text)) return "24k";
  return "22k";
}

export function goldPurityLabel(value: unknown): string {
  return normalizeGoldPurity(value).toUpperCase();
}

export function goldPurityMark(value: unknown): string {
  return normalizeGoldPurity(value) === "24k" ? "999" : "916";
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface GoldPurchaseBreakdown {
  grams: number;
  pricePerGram: number;
  wastagePercent: number;
  gstPercent: number;
  goldValue: number;
  wastageAmount: number;
  gstAmount: number;
  totalPaid: number;
}

export function calculateGoldPurchase(
  grams: number,
  pricePerGram: number,
  wastagePercent: number,
  gstPercent: number,
): GoldPurchaseBreakdown {
  const goldValue = roundMoney(grams * pricePerGram);
  const wastageAmount = roundMoney((goldValue * wastagePercent) / 100);
  const gstAmount = roundMoney(((goldValue + wastageAmount) * gstPercent) / 100);
  const totalPaid = roundMoney(goldValue + wastageAmount + gstAmount);

  return {
    grams,
    pricePerGram,
    wastagePercent,
    gstPercent,
    goldValue,
    wastageAmount,
    gstAmount,
    totalPaid,
  };
}

export interface GoldEntryDetails {
  gold_price_per_gram?: number;
  gold_value?: number;
  wastage_percent?: number;
  wastage_amount?: number;
  gst_percent?: number;
  gst_amount?: number;
  total_paid?: number;
  purity?: GoldPurity;
}

export function asGoldEntryDetails(
  value: Record<string, unknown> | null | undefined,
): GoldEntryDetails {
  return (value ?? {}) as GoldEntryDetails;
}
