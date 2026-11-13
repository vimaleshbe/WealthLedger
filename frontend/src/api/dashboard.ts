import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type {
  DashboardSummary,
  AllocationResponse,
  ReturnScope,
  ScopeReturnSummary,
  TrendResponse,
  XirrHistoryResponse,
  XirrResponse,
} from "../types";

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get("/dashboard/summary"),
  });
}

export function useDashboardAllocation() {
  return useQuery<AllocationResponse>({
    queryKey: ["dashboard", "allocation"],
    queryFn: () => api.get("/dashboard/allocation"),
  });
}

export function useDashboardTrend(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return useQuery<TrendResponse>({
    queryKey: ["dashboard", "trend", startDate, endDate],
    queryFn: () => api.get(`/dashboard/trend${query}`),
  });
}

export function useDashboardXirr(scope: ReturnScope = "portfolio") {
  return useQuery<XirrResponse>({
    queryKey: ["dashboard", "xirr", scope],
    queryFn: () => api.get(`/dashboard/xirr?scope=${scope}`),
  });
}

export function useDashboardReturns(scope: ReturnScope = "portfolio") {
  return useQuery<ScopeReturnSummary>({
    queryKey: ["dashboard", "returns", scope],
    queryFn: () => api.get(`/dashboard/returns?scope=${scope}`),
  });
}

export function useDashboardXirrHistory() {
  return useQuery<XirrHistoryResponse>({
    queryKey: ["dashboard", "xirr", "history"],
    queryFn: () => api.get("/dashboard/xirr/history"),
  });
}
