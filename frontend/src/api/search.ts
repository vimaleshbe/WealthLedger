import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
}

export function useSymbolSearch(query: string, type: "stock" | "mutual_fund" | undefined) {
  return useQuery<{ results: SearchResult[] }>({
    queryKey: ["search", type, query],
    queryFn: () =>
      api.get(`/search?query=${encodeURIComponent(query)}&type=${type}`),
    enabled: !!type && query.length >= 2,
  });
}
