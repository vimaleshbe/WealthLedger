import ErrorState from "../components/ErrorState";
import TotalValueCard from "../components/TotalValueCard";
import NetWorthCard from "../components/NetWorthCard";
import CashCard from "../components/CashCard";
import AllocationChart from "../components/AllocationChart";
import TrendChart from "../components/TrendChart";
import XirrTrendChart from "../components/XirrTrendChart";
import EmptyState from "../components/EmptyState";
import ReturnCard from "../components/ReturnCard";
import { DashboardSkeleton } from "../components/PageSkeletons";
import { Skeleton } from "../components/ui/skeleton";
import {
  useDashboardSummary,
  useDashboardAllocation,
  useDashboardCagr,
  useDashboardTrend,
  useDashboardXirr,
  useDashboardXirrHistory,
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
  const { data: xirr, isLoading: xirrLoading } = useDashboardXirr("portfolio");
  const { data: equityXirr, isLoading: equityXirrLoading } =
    useDashboardXirr("equity");
  const { data: goldXirr, isLoading: goldXirrLoading } =
    useDashboardXirr("gold");
  const { data: cagr, isLoading: cagrLoading } = useDashboardCagr("portfolio");
  const { data: equityCagr, isLoading: equityCagrLoading } =
    useDashboardCagr("equity");
  const { data: goldCagr, isLoading: goldCagrLoading } =
    useDashboardCagr("gold");
  const { data: xirrHistory, isLoading: xirrHistoryLoading } =
    useDashboardXirrHistory();

  if (summaryLoading) {
    return <DashboardSkeleton />;
  }

  if (summaryError) {
    return <ErrorState onRetry={refetchSummary} />;
  }

  if (!summary || (summary.asset_count === 0 && summary.cash_value === 0)) {
    return (
      <div className="space-y-6">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NetWorthCard netWorth={summary.net_worth} />
        <TotalValueCard
          portfolioValue={summary.portfolio_value}
          assetCount={summary.asset_count}
        />
        <CashCard
          cashValue={summary.cash_value}
          cashAssetId={summary.cash_asset_id}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cagrLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={cagr?.cagr_percent}
            title="Portfolio CAGR"
            scope="Stocks + Mutual Funds + Gold + PPF"
            badge="Annualized"
          />
        )}
        {equityCagrLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={equityCagr?.cagr_percent}
            title="Equity CAGR"
            scope="Stocks + Mutual Funds (excl. gold)"
            badge="Annualized"
          />
        )}
        {goldCagrLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={goldCagr?.cagr_percent}
            title="Gold CAGR"
            scope="Physical Gold + Gold ETFs & Funds"
            badge="Annualized"
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {xirrLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={xirr?.xirr_percent}
            title="Portfolio XIRR"
            scope="Stocks + Mutual Funds + Gold + PPF"
          />
        )}
        {equityXirrLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={equityXirr?.xirr_percent}
            title="Equity XIRR"
            scope="Stocks + Mutual Funds (excl. gold)"
          />
        )}
        {goldXirrLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={goldXirr?.xirr_percent}
            title="Gold XIRR"
            scope="Physical Gold + Gold ETFs & Funds"
          />
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

      <XirrTrendChart
        data={xirrHistory?.points ?? []}
        isLoading={xirrHistoryLoading}
      />
    </div>
  );
}
