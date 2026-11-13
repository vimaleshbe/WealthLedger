import { useMemo, useState } from "react";
import { CalendarDays, Search, Wallet, X } from "lucide-react";
import ErrorState from "../components/ErrorState";
import { TransactionsSkeleton } from "../components/PageSkeletons";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { useTransactions } from "../api/transactions";
import {
  ENTRY_TYPE_LABELS,
  getAssetTypeLabel,
  isCashEntry,
} from "../lib/assetTypes";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
} from "../lib/utils";
import type { EntryType } from "../types";

function entryBadgeClass(type: EntryType): string {
  switch (type) {
    case "sell":
      return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "deposit":
      return "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300";
    case "withdrawal":
      return "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
    default:
      return "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300";
  }
}

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
        ENTRY_TYPE_LABELS[txn.entry_type].toLowerCase().includes(q) ||
        txn.date.includes(q),
    );
  }, [transactions, query]);

  if (isLoading) return <TransactionsSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;

  const total = transactions?.length ?? 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        total > 0 && "h-[calc(100vh-12rem)] min-h-[420px]",
      )}
    >
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {total} entries · scroll to view all
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

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">No transactions yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Record a buy, sell or cash deposit from an asset&apos;s page and it
            will show up here.
          </p>
        </div>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
              <Search className="h-8 w-8 text-muted-foreground/60" />
              <h3 className="mt-3 font-semibold">No matching entries</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term.
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold sm:px-5">Date</th>
                    <th className="px-4 py-3 font-semibold sm:px-5">Asset</th>
                    <th className="px-4 py-3 font-semibold sm:px-5">
                      Activity
                    </th>
                    <th className="px-4 py-3 text-right font-semibold sm:px-5">
                      Units
                    </th>
                    <th className="px-4 py-3 text-right font-semibold sm:px-5">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((txn) => {
                    const cashEntry = isCashEntry(txn.entry_type);
                    const isGold = txn.asset_type === "physical_gold";
                    const amount = txn.cash_value ?? txn.value;
                    const isCashIn =
                      txn.entry_type === "sell" ||
                      txn.entry_type === "deposit";
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
                                {txn.notes || ENTRY_TYPE_LABELS[txn.entry_type]}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 sm:px-5">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div>
                              <p className="max-w-[280px] truncate font-medium">
                                {txn.asset_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {getAssetTypeLabel(txn.asset_type)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <Badge className={entryBadgeClass(txn.entry_type)}>
                            {ENTRY_TYPE_LABELS[txn.entry_type]}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-muted-foreground sm:px-5">
                          {cashEntry
                            ? "—"
                            : `${formatNumber(txn.units, 3)}${isGold ? " g" : ""}`}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums sm:px-5",
                            isCashIn && "text-emerald-600 dark:text-emerald-400",
                            txn.entry_type === "withdrawal" &&
                              "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {txn.entry_type === "sell" ||
                          txn.entry_type === "deposit"
                            ? "+"
                            : txn.entry_type === "withdrawal"
                              ? "−"
                              : ""}
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
