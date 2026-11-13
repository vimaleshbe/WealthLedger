import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidatePortfolio } from "./assets";
import type { Asset, AssetCreate, FDSummary } from "../types";

export function useFds() {
  return useQuery<FDSummary[]>({
    queryKey: ["fd"],
    queryFn: () => api.get("/fd"),
  });
}

export function useFdSummary(assetId: number | undefined) {
  return useQuery<FDSummary>({
    queryKey: ["fd", assetId],
    queryFn: () => api.get(`/fd/${assetId}/summary`),
    enabled: !!assetId,
  });
}

export function useCreateFd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssetCreate) => api.post<Asset>("/assets", data),
    onSuccess: () => invalidatePortfolio(queryClient),
  });
}

export function useUpdateFd(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssetCreate) => api.put<Asset>(`/assets/${assetId}`, data),
    onSuccess: () => invalidatePortfolio(queryClient),
  });
}
