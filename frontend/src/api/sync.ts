import { useMutation, useQuery, useQueryClient, useIsMutating } from "@tanstack/react-query";
import { api } from "./client";

export interface SyncStatusResponse {
  last_sync_at: string | null;
  next_sync_at: string | null;
  stale_assets: { asset_id: number; symbol: string; last_price: number; fetched_at: string }[];
}

export const SYNC_MUTATION_KEY = ["sync", "market-data", "trigger"] as const;

export function useSyncStatus() {
  return useQuery<SyncStatusResponse>({
    queryKey: ["sync", "status"],
    queryFn: () => api.get("/sync/market-data/status"),
  });
}

export function useMarketSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SYNC_MUTATION_KEY,
    mutationFn: () => api.post("/sync/market-data", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync", "status"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useIsMarketSyncing() {
  return useIsMutating({ mutationKey: SYNC_MUTATION_KEY }) > 0;
}
