import type { AssetType, Category } from "../types";

export const ASSET_TYPES: { value: AssetType; label: string; category: Category }[] = [
  { value: "stock", label: "Stock", category: "equity" },
  { value: "mutual_fund", label: "Mutual Fund", category: "equity" },
  { value: "nps", label: "NPS", category: "retirement" },
  { value: "ppf", label: "PPF", category: "retirement" },
  { value: "bank_balance", label: "Bank Balance", category: "cash" },
  { value: "pf", label: "PF", category: "retirement" },
  { value: "physical_gold", label: "Physical Gold", category: "commodities" },
  { value: "real_estate", label: "Real Estate", category: "real_estate" },
];

export function getCategoryForAssetType(assetType: AssetType): Category {
  return ASSET_TYPES.find((t) => t.value === assetType)?.category ?? "equity";
}

export function getAssetTypeLabel(assetType: AssetType): string {
  return ASSET_TYPES.find((t) => t.value === assetType)?.label ?? assetType;
}
