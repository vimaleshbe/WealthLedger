import { Link } from "react-router-dom";
import { ArrowUpRight, Landmark, PiggyBank, Wallet } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import PageHeader from "../components/PageHeader";
import ErrorState from "../components/ErrorState";
import { useRetirementAccounts } from "../api/retirement";
import { getAssetTypeLabel } from "../lib/assetTypes";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
} from "../lib/utils";
import type { RetirementAccount } from "../types";

function accountPath(account: RetirementAccount): string {
  if (account.asset_type === "pf") return "/pf";
  if (account.asset_type === "ppf") return "/ppf";
  return "/nps";
}

function AccountCard({ account }: { account: RetirementAccount }) {
  const isPF = account.asset_type === "pf";
  const isNPS = account.asset_type === "nps";
  return (
    <Link to={accountPath(account)} className="block h-full">
      <Card className="group relative flex h-full flex-col overflow-hidden border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
        <CardContent className="relative flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {getAssetTypeLabel(account.asset_type)}
              </p>
              <p className="mt-1.5 truncate text-xl font-bold tracking-tight">
                {account.name}
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight">
                {formatCurrency(account.balance)}
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/10 dark:text-amber-400">
              <Landmark className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-4 text-sm">
            {isPF ? (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Employee
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatCurrency(account.employee_total)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Employer
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatCurrency(account.employer_total)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pension
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatCurrency(account.pension_total)}
                  </p>
                </div>
              </>
            ) : isNPS ? (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Invested
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatCurrency(account.invested_value)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Gain
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 font-semibold tabular-nums",
                      account.gain >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {formatCurrency(account.gain)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Units
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatNumber(account.units, 4)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Money added
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatCurrency(account.contributions)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Interest
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(account.interest_total)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Withdrawn
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {formatCurrency(account.withdrawal_total)}
                  </p>
                </div>
              </>
            )}
          </div>

          {isNPS && account.latest_nav !== null && (
            <p className="mt-3 text-xs text-muted-foreground">
              Latest NAV {formatCurrency(account.latest_nav)} ·{" "}
              {formatNumber(account.units, 4)} units
            </p>
          )}

          {account.asset_type === "ppf" && account.maturity_date && (
            <p className="mt-3 text-xs text-muted-foreground">
              Matures {formatDate(account.maturity_date)} · 15-year term
            </p>
          )}

          <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
            <span>
              {account.entry_count}{" "}
              {account.entry_count === 1 ? "entry" : "entries"}
            </span>
            <span className="inline-flex items-center gap-0.5 font-medium">
              Open
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Retirement() {
  const { data, isLoading, error, refetch } = useRetirementAccounts();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[140px] rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-[250px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retirement"
        description="PF and PPF balances plus your NPS value. These accounts count in net worth but are separate from Total Portfolio and XIRR."
      >
        <Badge variant="outline" className="py-1">
          {data.accounts.length}{" "}
          {data.accounts.length === 1 ? "account" : "accounts"}
        </Badge>
      </PageHeader>

      <Card className="relative overflow-hidden border-border/70">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.08] via-transparent to-emerald-500/[0.06]" />
        <CardContent className="relative flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <PiggyBank className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Total Retirement Balance
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {formatCurrency(data.total_balance)}
              </p>
            </div>
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            Included in Net Worth. Excluded from Total Portfolio and XIRR,
            because these are balance accounts rather than market holdings.
          </p>
        </CardContent>
      </Card>

      {data.accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground/60" />
          <h2 className="mt-4 text-lg font-semibold">No retirement accounts</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            PF, PPF and NPS accounts are created automatically. Add an entry to
            start tracking a balance.
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            data.accounts.length === 1
              ? "max-w-md"
              : "md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {data.accounts.map((account) => (
            <AccountCard key={account.asset_id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
