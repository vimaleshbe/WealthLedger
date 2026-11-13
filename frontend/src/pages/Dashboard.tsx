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
  useDashboardReturns,
  useDashboardTrend,
  useDashboardXirr,
  useDashboardXirrHistory,
} from "../api/dashboard";

function holdingLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return "";
  if (days >= 365) return `${(days / 365.25).toFixed(1)}y`;
  return `${days}d`;
}

function returnTitle(label: string, metric: string | undefined): string {
  return metric === "cagr" ? `${label} CAGR` : `${label} Return`;
}

function returnBadge(
  metric: string | undefined,
  days: number | null | undefined,
): string {
  const period = holdingLabel(days);
  const base = metric === "cagr" ? "Annualized" : "Absolute";
  return period ? `${base} · ${period}` : base;
}

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
  const { data: portfolioReturn, isLoading: portfolioReturnLoading } =
    useDashboardReturns("portfolio");
  const { data: equityReturn, isLoading: equityReturnLoading } =
    useDashboardReturns("equity");
  const { data: goldReturn, isLoading: goldReturnLoading } =
    useDashboardReturns("gold");
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
        {portfolioReturnLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={portfolioReturn?.percent}
            title={returnTitle("Portfolio", portfolioReturn?.metric)}
            scope="Stocks + Mutual Funds + Gold + PPF"
            badge={returnBadge(
              portfolioReturn?.metric,
              portfolioReturn?.period_days,
            )}
          />
        )}
        {equityReturnLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={equityReturn?.percent}
            title={returnTitle("Equity", equityReturn?.metric)}
            scope="Stocks + Mutual Funds (excl. gold)"
            badge={returnBadge(
              equityReturn?.metric,
              equityReturn?.period_days,
            )}
          />
        )}
        {goldReturnLoading ? (
          <Skeleton className="h-full min-h-[148px] rounded-xl" />
        ) : (
          <ReturnCard
            percent={goldReturn?.percent}
            title={returnTitle("Gold", goldReturn?.metric)}
            scope="Physical Gold + Gold ETFs & Funds"
            badge={returnBadge(goldReturn?.metric, goldReturn?.period_days)}
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
