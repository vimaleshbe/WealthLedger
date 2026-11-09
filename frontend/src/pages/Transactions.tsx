import { useMemo, useState } from "react";
import {
  CalendarDays,
  Search,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import ErrorState from "../components/ErrorState";
import { TransactionsSkeleton } from "../components/PageSkeletons";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { useTransactions } from "../api/transactions";
import { getAssetTypeLabel, getCategoryForAssetType } from "../lib/assetTypes";
import { categoryBadgeClass } from "../lib/categories";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
} from "../lib/utils";

export default function Transactions() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions ?? [];
    return (transactions ?? []).filter(
      (txn) =>
        txn.asset_name.toLowerCase().includes(q) ||
        getAssetTypeLabel(txn.asset_type).toLowerCase().includes(q) ||
        txn.date.includes(q),
    );
  }, [transactions, query]);

  const totalInvested = useMemo(
    () => (transactions ?? []).reduce((sum, txn) => sum + txn.value, 0),
    [transactions],
  );

  const latestDate = useMemo(() => {
    if (!transactions?.length) return null;
    return transactions.reduce(
      (latest, txn) => (txn.date > latest ? txn.date : latest),
      transactions[0].date,
    );
  }, [transactions]);

  if (isLoading) return <TransactionsSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every investment entry across your portfolio, newest first."
      >
        <Badge variant="outline" className="py-1">
          {transactions?.length ?? 0} entries
        </Badge>
      </PageHeader>

      {transactions?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">No transactions yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add entries from an asset&apos;s detail page and they will show up
            here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ArrowLeftRight className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Entries
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatNumber(transactions?.length ?? 0, 0)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Invested
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatCompactCurrency(totalInvested)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Latest Entry
                  </p>
                  <p className="text-lg font-bold">
                    {latestDate ? formatDate(latestDate) : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-base font-semibold">Activity</h2>
                <p className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {transactions?.length ?? 0} entries
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search entries…"
                  className="h-10 pl-9 pr-9"
                  aria-label="Search transactions"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <Search className="h-8 w-8 text-muted-foreground/60" />
                <h3 className="mt-3 font-semibold">No matching entries</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search term.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-semibold sm:px-5">Date</th>
                      <th className="px-4 py-3 font-semibold sm:px-5">Asset</th>
                      <th className="px-4 py-3 font-semibold sm:px-5">Type</th>
                      <th className="px-4 py-3 text-right font-semibold sm:px-5">
                        Units
                      </th>
                      <th className="px-4 py-3 text-right font-semibold sm:px-5">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filtered.map((txn) => {
                      const category = getCategoryForAssetType(txn.asset_type);
                      return (
                        <tr
                          key={`${txn.asset_id}-${txn.id}`}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <CalendarDays className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="font-medium">{formatDate(txn.date)}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {txn.notes || "Entry"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 sm:px-5">
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="max-w-[280px] truncate font-medium">
                                {txn.asset_name}
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                            <Badge className={categoryBadgeClass(category)}>
                              {getAssetTypeLabel(txn.asset_type)}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-muted-foreground sm:px-5">
                            {formatNumber(txn.units, 3)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums sm:px-5">
                            {formatCurrency(txn.value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
