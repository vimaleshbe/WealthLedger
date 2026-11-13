import type { AssetType, Category, EntryType } from "../types";

export const ASSET_TYPES: { value: AssetType; label: string; category: Category }[] = [
  { value: "stock", label: "Stock", category: "equity" },
  { value: "mutual_fund", label: "Mutual Fund", category: "equity" },
  { value: "fixed_deposit", label: "Fixed Deposit", category: "debt" },
  { value: "liquid_fund", label: "Liquid Fund", category: "debt" },
  { value: "arbitrage_fund", label: "Arbitrage Fund", category: "debt" },
  { value: "nps", label: "NPS", category: "others" },
  { value: "ppf", label: "PPF", category: "debt" },
  { value: "pf", label: "PF", category: "debt" },
  { value: "cash", label: "Cash", category: "cash" },
  { value: "bank_balance", label: "Bank Balance", category: "cash" },
  { value: "physical_gold", label: "Physical Gold", category: "gold" },
  { value: "real_estate", label: "Real Estate", category: "real_estate" },
];

/** Balance accounts shown in the Retirement tab, not in Assets. */
export const RETIREMENT_ASSET_TYPES: readonly AssetType[] = ["pf", "ppf", "nps"];

export function isRetirementAssetType(assetType: AssetType | string): boolean {
  return RETIREMENT_ASSET_TYPES.includes(assetType as AssetType);
}

/** Fixed deposits have their own dedicated page. */
export function isFdAssetType(assetType: AssetType | string): boolean {
  return assetType === "fixed_deposit";
}

/** The Assets tab is limited to market holdings and property. */
const ASSET_PICKER_TYPES: AssetType[] = [
  "stock",
  "mutual_fund",
  "physical_gold",
  "real_estate",
];

export const SELECTABLE_ASSET_TYPES = ASSET_TYPES.filter((type) =>
  ASSET_PICKER_TYPES.includes(type.value),
);

/** Types that can be edited on an existing asset. */
export const EDITABLE_ASSET_TYPES = SELECTABLE_ASSET_TYPES;

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  interest: "Interest",
};

export function isCashEntry(type: EntryType): boolean {
  return type === "deposit" || type === "withdrawal";
}

export function getCategoryForAssetType(assetType: AssetType): Category {
  return ASSET_TYPES.find((t) => t.value === assetType)?.category ?? "equity";
}

export function getAssetTypeLabel(assetType: AssetType): string {
  return ASSET_TYPES.find((t) => t.value === assetType)?.label ?? assetType;
}
