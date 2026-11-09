import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Asset, AssetEntry, Transaction } from "../types";

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const assets = await api.get<Asset[]>("/assets");
      const entriesByAsset = await Promise.all(
        assets.map((asset) =>
          api.get<AssetEntry[]>(`/assets/${asset.id}/entries`).then((entries) =>
            entries.map((entry) => ({
              ...entry,
              asset_name: asset.name,
              asset_type: asset.asset_type,
            }))
          )
        )
      );
      const allTransactions = entriesByAsset.flat();
      return allTransactions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
  });
}
