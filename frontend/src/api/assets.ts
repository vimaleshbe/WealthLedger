import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Asset, AssetCreate, AssetEntry, AssetValuation, EntryCreate } from "../types";

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useUpdateAsset(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssetCreate) => api.put<Asset>(`/assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["assets", id] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/assets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets", assetId, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets", assetId, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteEntry(assetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) =>
      api.delete(`/assets/${assetId}/entries/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets", assetId, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
