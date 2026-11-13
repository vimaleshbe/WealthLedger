import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { RetirementList } from "../types";

export function useRetirementAccounts() {
  return useQuery<RetirementList>({
    queryKey: ["retirement"],
    queryFn: () => api.get("/retirement"),
  });
}
