import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { DashboardSummary, AllocationResponse, TrendResponse, XirrResponse } from "../types";

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

export function useDashboardXirr() {
  return useQuery<XirrResponse>({
    queryKey: ["dashboard", "xirr"],
    queryFn: () => api.get("/dashboard/xirr"),
  });
}
