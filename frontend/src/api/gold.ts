import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { GoldRatesResponse } from "../types";

export function useGoldRates(enabled = true) {
  return useQuery<GoldRatesResponse>({
    queryKey: ["gold", "rates"],
    queryFn: () => api.get("/gold/rates"),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
