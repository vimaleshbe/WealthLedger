import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowLeft,
  Building2,
  CalendarDays,
  Pencil,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import ErrorState from "../components/ErrorState";
import FDEntryForm, { type FDEntryKind } from "../components/FDEntryForm";
import FDForm from "../components/FDForm";
import PageHeader from "../components/PageHeader";
import {
  useAsset,
  useCreateEntry,
  useDeleteEntry,
  useEntries,
  useUpdateEntry,
} from "../api/assets";
import { useFdSummary, useUpdateFd } from "../api/fd";
import { useToast } from "../components/ui/toast";
import { fdStatus, tenureLabel } from "../lib/fd";
import { cn, formatCurrency, formatDate } from "../lib/utils";
import type { AssetCreate, AssetEntry, EntryCreate } from "../types";

function entryTypeLabel(entry: AssetEntry): string {
  if (entry.entry_type === "interest") return "Interest";
  if (entry.entry_type === "sell") return "Withdrawal";
  return "Principal";
}

function entryBadgeClass(entry: AssetEntry): string {
  switch (entry.entry_type) {
    case "interest":
      return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "sell":
      return "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
    default:
      return "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300";
  }
}

export default function FDDetail() {
  const { id } = useParams<{ id: string }>();
  const assetId = id ? parseInt(id, 10) : undefined;
  const { success, error: showError } = useToast();

  const {
    data: asset,
    isLoading: assetLoading,
    error: assetError,
    refetch: refetchAsset,
  } = useAsset(assetId);
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useFdSummary(assetId);
  const { data: entries, isLoading: entriesLoading } = useEntries(assetId);
  const createEntry = useCreateEntry(assetId ?? 0);
  const updateEntry = useUpdateEntry(assetId ?? 0);
  const deleteEntry = useDeleteEntry(assetId ?? 0);
  const updateFd = useUpdateFd(assetId ?? 0);

  const [entryKind, setEntryKind] = useState<FDEntryKind | null>(null);
  const [editingEntry, setEditingEntry] = useState<AssetEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);
  const [editFdOpen, setEditFdOpen] = useState(false);
  const submittingEntryRef = useRef(false);
  const submittingFdRef = useRef(false);
  const isEntrySubmitting = createEntry.isPending || updateEntry.isPending;
  const isFdSubmitting = updateFd.isPending;

  const sortedEntries = entries
    ? [...entries].sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          b.id - a.id,
      )
    : [];

  const openCreate = (kind: FDEntryKind) => {
    setEditingEntry(null);
    setEntryKind(kind);
  };

  const openEdit = (entry: AssetEntry) => {
    setEditingEntry(entry);
    setEntryKind(entry.entry_type === "interest" ? "interest" : "withdrawal");
  };

  const closeEntryDialog = () => {
    setEntryKind(null);
    setEditingEntry(null);
  };

  const handleEntrySubmit = (data: EntryCreate) => {
    if (submittingEntryRef.current) return;
    submittingEntryRef.current = true;
    const release = () => {
      submittingEntryRef.current = false;
    };
    const onSuccess = () => {
      success(
        data.entry_type === "interest"
          ? "Interest added."
          : editingEntry
            ? "Withdrawal updated."
            : "Withdrawal recorded. Cash credited.",
      );
      closeEntryDialog();
    };
    const onError = (err: Error) =>
      showError(err.message || "Could not save the entry.");

    if (editingEntry) {
      updateEntry.mutate(
        { entryId: editingEntry.id, data },
        { onSuccess, onError, onSettled: release },
      );
    } else {
      createEntry.mutate(data, { onSuccess, onError, onSettled: release });
    }
  };

  const confirmDelete = () => {
    if (deleteEntryId === null) return;
    deleteEntry.mutate(deleteEntryId, {
      onSuccess: () => {
        setDeleteEntryId(null);
        success("Entry deleted.");
      },
      onError: (err: Error) =>
        showError(err.message || "Could not delete the entry."),
    });
  };

  const handleEditFd = (payload: AssetCreate) => {
    if (submittingFdRef.current) return;
    submittingFdRef.current = true;
    updateFd.mutate(payload, {
      onSuccess: () => {
        setEditFdOpen(false);
        success("FD updated.");
      },
      onError: (err: Error) => showError(err.message || "Could not update the FD."),
      onSettled: () => {
        submittingFdRef.current = false;
      },
    });
  };

  if (assetLoading || summaryLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    );
  }

  if (assetError || summaryError || !asset || !summary) {
    return (
      <ErrorState
        onRetry={() => {
          void refetchAsset();
          void refetchSummary();
        }}
      />
    );
  }

  const status = fdStatus(summary.days_remaining);
  const availableBalance =
    summary.balance +
    (editingEntry?.entry_type === "sell" ? editingEntry.value : 0);
  const dialogTitle = editingEntry
    ? "Edit Entry"
    : entryKind === "interest"
      ? "Add Interest"
      : "Withdraw";
  const dialogDescription = editingEntry
    ? "Update this FD entry."
    : entryKind === "interest"
      ? "Add the interest credited to this FD."
      : "The withdrawal is credited back to Cash.";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/fd" className="-ml-2 inline-flex">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to fixed deposits
        </Button>
      </Link>

      <PageHeader
        title={asset.name}
        description={
          summary.interest_rate !== null && summary.tenure_months
            ? `${summary.interest_rate}% p.a. · ${tenureLabel(
                summary.tenure_months,
              )} term`
            : "Fixed deposit account with its own tenure and interest rate."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => openCreate("interest")}>
            <TrendingUp className="h-4 w-4" />
            Add Interest
          </Button>
          <Button variant="outline" onClick={() => openCreate("withdrawal")}>
            <ArrowDownToLine className="h-4 w-4" />
            Withdraw
          </Button>
          <Button variant="outline" onClick={() => setEditFdOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit FD
          </Button>
        </div>
      </PageHeader>

      <Card className="relative overflow-hidden border-border/70">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-indigo-500/[0.07]" />
        <CardContent className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                FD Balance
              </p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight">
                {formatCurrency(summary.balance)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Principal + interest − withdrawals
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "border-transparent",
                  status === "Matured"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
                )}
              >
                <Building2 className="mr-1 h-3.5 w-3.5" />
                {status === "Unknown" ? "FD" : status}
              </Badge>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-5 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Principal
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {formatCurrency(summary.principal)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Interest earned
              </p>
              <p className="mt-1 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.interest)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Withdrawn
              </p>
              <p className="mt-1 font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {formatCurrency(summary.withdrawals)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Interest rate
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {summary.interest_rate !== null
                  ? `${summary.interest_rate}% p.a.`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Tenure
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {tenureLabel(summary.tenure_months)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Start date
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {summary.start_date ? formatDate(summary.start_date) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Maturity date
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {summary.maturity_date ? formatDate(summary.maturity_date) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Projected at maturity
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {summary.maturity_value !== null
                  ? formatCurrency(summary.maturity_value)
                  : "—"}
              </p>
            </div>
          </div>

          {summary.maturity_date && summary.days_remaining !== null && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {summary.days_remaining > 0
                ? `${summary.days_remaining} days until maturity`
                : "Maturity date reached"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">FD history</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {sortedEntries.length}{" "}
              {sortedEntries.length === 1 ? "entry" : "entries"} · principal,
              interest and withdrawals
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 py-10 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">
                No entries yet. Use Add Interest or Withdraw above.
              </p>
            </div>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border/60 sm:-mx-6 sm:-mb-6">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold sm:px-5">Date</th>
                    <th className="px-4 py-3 font-semibold sm:px-5">Type</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Cash movement
                    </th>
                    <th className="px-4 py-3 font-semibold sm:px-5">Notes</th>
                    <th className="px-4 py-3 text-right font-semibold sm:px-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sortedEntries.map((entry) => {
                    const isWithdrawal = entry.entry_type === "sell";
                    const isInterest = entry.entry_type === "interest";
                    const cashAmount = entry.affects_cash
                      ? (entry.cash_value ?? entry.value)
                      : null;
                    const cashEffect =
                      cashAmount === null
                        ? null
                        : isWithdrawal
                          ? cashAmount
                          : -cashAmount;
                    return (
                      <tr
                        key={entry.id}
                        className="group transition-colors hover:bg-muted/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <p className="font-medium">{formatDate(entry.date)}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <Badge className={entryBadgeClass(entry)}>
                            {entryTypeLabel(entry)}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums",
                            isWithdrawal
                              ? "text-rose-600 dark:text-rose-400"
                              : isInterest
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-foreground",
                          )}
                        >
                          {isWithdrawal ? "−" : "+"}
                          {formatCurrency(entry.value)}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right tabular-nums",
                            cashEffect === null
                              ? "text-muted-foreground"
                              : cashEffect > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {cashEffect === null
                            ? "—"
                            : `${cashEffect > 0 ? "+" : "−"}${formatCurrency(
                                Math.abs(cashEffect),
                              )}`}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3.5 text-muted-foreground sm:px-5">
                          {entry.notes || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right sm:px-5">
                          {entry.entry_type !== "buy" && (
                            <div className="flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(entry)}
                                aria-label="Edit entry"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteEntryId(entry.id)}
                                aria-label="Delete entry"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={entryKind !== null}
        onClose={closeEntryDialog}
        title={dialogTitle}
        description={dialogDescription}
      >
        {entryKind && (
          <FDEntryForm
            key={editingEntry?.id ?? `new-${entryKind}`}
            kind={entryKind}
            initial={editingEntry ?? undefined}
            availableBalance={availableBalance}
            isSubmitting={isEntrySubmitting}
            onSubmit={handleEntrySubmit}
            onCancel={closeEntryDialog}
          />
        )}
      </Dialog>

      <Dialog
        open={editFdOpen}
        onClose={() => setEditFdOpen(false)}
        title="Edit Fixed Deposit"
        description="Update the tenure, interest rate or other FD details."
      >
        <FDForm
          initial={asset}
          principal={summary.principal}
          isSubmitting={isFdSubmitting}
          onSubmit={handleEditFd}
          onCancel={() => setEditFdOpen(false)}
        />
      </Dialog>

      <Dialog
        open={deleteEntryId !== null}
        onClose={() => setDeleteEntryId(null)}
        title="Delete entry?"
        description="This action cannot be undone."
      >
        <div className="space-y-5">
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            Removing this entry will recalculate the FD balance and net worth.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteEntryId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteEntry.isPending}
            >
              {deleteEntry.isPending ? "Deleting…" : "Delete Entry"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
