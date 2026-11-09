import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { CashMovementCreate, CashSummary } from "../types";

export function useCashSummary(enabled = true) {
  return useQuery<CashSummary>({
    queryKey: ["cash"],
    queryFn: () => api.get("/cash"),
    enabled,
  });
}

function invalidateCash(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["cash"] });
  queryClient.invalidateQueries({ queryKey: ["assets"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

export function useDepositCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CashMovementCreate) =>
      api.post<CashSummary>("/cash/deposit", data),
    onSuccess: () => invalidateCash(queryClient),
  });
}

export function useWithdrawCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CashMovementCreate) =>
      api.post<CashSummary>("/cash/withdraw", data),
    onSuccess: () => invalidateCash(queryClient),
  });
}
