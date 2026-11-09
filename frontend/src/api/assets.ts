import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Asset, AssetCreate, AssetEntry, AssetValuation, EntryCreate } from "../types";

function invalidatePortfolio(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["assets"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["cash"] });
}

export function useAssets() {
  return useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: () => api.get("/assets"),
  });
}

export function useAsset(id: number | undefined) {
  return useQuery<Asset>({
    queryKey: ["assets", id],
    queryFn: () => api.get(`/assets/${id}`),
    enabled: !!id,
  });
}

export function useAssetValuation(id: number | undefined) {
  return useQuery<AssetValuation>({
    queryKey: ["assets", id, "valuation"],
    queryFn: () => api.get(`/assets/${id}/valuation`),
    enabled: !!id,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssetCreate) => api.post<Asset>("/assets", data),
    onSuccess: () => invalidatePortfolio(queryClient),
  });
}

export function useUpdateAsset(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssetCreate) => api.put<Asset>(`/assets/${id}`, data),
    onSuccess: () => invalidatePortfolio(queryClient),
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/assets/${id}`),
    onSuccess: () => invalidatePortfolio(queryClient),
  });
}

export function useEntries(assetId: number | undefined) {
  return useQuery<AssetEntry[]>({
    queryKey: ["assets", assetId, "entries"],
    queryFn: () => api.get(`/assets/${assetId}/entries`),
    enabled: !!assetId,
  });
}

export function useCreateEntry(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EntryCreate) =>
      api.post<AssetEntry>(`/assets/${assetId}/entries`, data),
    onSuccess: () => invalidatePortfolio(queryClient),
  });
}

export function useUpdateEntry(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entryId,
      data,
    }: {
      entryId: number;
      data: EntryCreate;
    }) => api.put<AssetEntry>(`/assets/${assetId}/entries/${entryId}`, data),
    onSuccess: () => invalidatePortfolio(queryClient),
  });
}

export function useDeleteEntry(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) =>
      api.delete(`/assets/${assetId}/entries/${entryId}`),
    onSuccess: () => invalidatePortfolio(queryClient),
  });
}
