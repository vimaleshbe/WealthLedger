import { Clock } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ErrorState from "../components/ErrorState";
import TotalValueCard from "../components/TotalValueCard";
import NetWorthCard from "../components/NetWorthCard";
import CashCard from "../components/CashCard";
import AllocationChart from "../components/AllocationChart";
import TrendChart from "../components/TrendChart";
import EmptyState from "../components/EmptyState";
import XirrCard from "../components/XirrCard";
import { DashboardSkeleton } from "../components/PageSkeletons";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { formatRelativeTime } from "../lib/utils";
import {
  useDashboardSummary,
  useDashboardAllocation,
  useDashboardTrend,
  useDashboardXirr,
} from "../api/dashboard";

export default function Dashboard() {
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useDashboardSummary();
  const { data: allocation, isLoading: allocationLoading } = useDashboardAllocation();
  const { data: trend, isLoading: trendLoading } = useDashboardTrend();
  const { data: xirr, isLoading: xirrLoading } = useDashboardXirr();

  if (summaryLoading) {
    return <DashboardSkeleton />;
  }

  if (summaryError) {
    return <ErrorState onRetry={refetchSummary} />;
  }

  if (!summary || (summary.asset_count === 0 && summary.cash_value === 0)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="A clear view of your portfolio performance"
        />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="A clear view of your portfolio performance"
      >
        <Badge variant="outline" className="gap-1.5 py-1">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Updated {formatRelativeTime(summary.last_updated)}
        </Badge>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TotalValueCard
          portfolioValue={summary.portfolio_value}
          assetCount={summary.asset_count}
        />
        <NetWorthCard netWorth={summary.net_worth} />
        <CashCard
          cashValue={summary.cash_value}
          cashAssetId={summary.cash_asset_id}
        />
        {xirrLoading ? (
          <Skeleton className="h-[148px] rounded-xl" />
        ) : (
          <XirrCard xirrPercent={xirr?.xirr_percent} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {allocationLoading ? (
          <Skeleton className="h-[360px] rounded-xl lg:col-span-2" />
        ) : (
          allocation && (
            <div className="lg:col-span-2">
              <AllocationChart data={allocation.by_category} />
            </div>
          )
        )}
        {trendLoading ? (
          <Skeleton className="h-[360px] rounded-xl lg:col-span-3" />
        ) : (
          trend && (
            <div className="lg:col-span-3">
              <TrendChart data={trend.points} />
            </div>
          )
        )}
      </div>
    </div>
  );
}
