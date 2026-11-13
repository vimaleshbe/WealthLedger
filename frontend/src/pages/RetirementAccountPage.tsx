import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowLeft,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import ErrorState from "../components/ErrorState";
import PageHeader from "../components/PageHeader";
import RetirementForm, {
  type RetirementEntryKind,
} from "../components/RetirementForm";
import RetirementSummaryCard from "../components/RetirementSummaryCard";
import {
  useAsset,
  useCreateEntry,
  useDeleteEntry,
  useEntries,
  useUpdateEntry,
} from "../api/assets";
import { useCashSummary } from "../api/cash";
import { useRetirementAccounts } from "../api/retirement";
import { useToast } from "../components/ui/toast";
import { ENTRY_TYPE_LABELS } from "../lib/assetTypes";
import { asPFComponents, pfComponentsTotal } from "../lib/retirement";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
} from "../lib/utils";
import type { AssetEntry, AssetType, EntryCreate } from "../types";

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

function entryLabel(entry: AssetEntry, assetType: AssetType): string {
  if (assetType === "nps") {
    if (entry.entry_type === "buy") return "Invest";
    if (entry.entry_type === "sell") return "Redeem";
  }
  if (entry.entry_type === "buy") {
    return assetType === "ppf" ? "Money added" : "Contribution";
  }
  return ENTRY_TYPE_LABELS[entry.entry_type];
}

export default function RetirementAccountPage({
  assetType,
}: {
  assetType: AssetType;
}) {
  const { success, error: showError } = useToast();
  const isPPF = assetType === "ppf";
  const isNPS = assetType === "nps";
  const {
    data: retirement,
    isLoading: retirementLoading,
    error: retirementError,
    refetch: refetchRetirement,
  } = useRetirementAccounts();
  const account = retirement?.accounts.find(
    (item) => item.asset_type === assetType,
  );
  const assetId = account?.asset_id;
  const {
    data: asset,
    isLoading: assetLoading,
    error: assetError,
    refetch: refetchAsset,
  } = useAsset(assetId);
  const { data: entries, isLoading: entriesLoading } = useEntries(assetId);
  const { data: cash } = useCashSummary(assetType === "ppf");
  const createEntry = useCreateEntry(assetId ?? 0);
  const updateEntry = useUpdateEntry(assetId ?? 0);
  const deleteEntry = useDeleteEntry(assetId ?? 0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AssetEntry | null>(null);
  const [newEntryKind, setNewEntryKind] =
    useState<RetirementEntryKind>("contribution");
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);
  const submittingRef = useRef(false);
  const isSubmitting = createEntry.isPending || updateEntry.isPending;

  const sortedEntries = entries
    ? [...entries].sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          b.id - a.id,
      )
    : [];

  const openCreate = (kind: RetirementEntryKind = "contribution") => {
    setEditingEntry(null);
    setNewEntryKind(kind);
    setDialogOpen(true);
  };

  const openEdit = (entry: AssetEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingEntry(null);
  };

  const handleSubmit = (data: EntryCreate) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const release = () => {
      submittingRef.current = false;
    };
    const onSuccess = () => {
      if (data.entry_type === "buy") {
        success(
          isPPF
            ? editingEntry
              ? "Money entry updated."
              : "Money added from Cash."
            : editingEntry
              ? "Contribution updated."
              : "Contribution added.",
        );
      } else if (data.entry_type === "interest") {
        success(editingEntry ? "Interest updated." : "Interest added.");
      } else {
        success(
          isPPF
            ? editingEntry
              ? "Withdrawal updated. Cash was adjusted."
              : "Withdrawal recorded. Cash was credited."
            : editingEntry
              ? "Withdrawal updated."
              : "Withdrawal recorded.",
        );
      }
      closeDialog();
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

  if (retirementLoading || assetLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    );
  }

  if (retirementError || assetError || !account || !asset) {
    return (
      <ErrorState
        onRetry={() => {
          void refetchRetirement();
          void refetchAsset();
        }}
      />
    );
  }

  const summary = account;
  const isPF = asset.asset_type === "pf";
  const availableBalance =
    summary.balance +
    (editingEntry?.entry_type === "sell" ? editingEntry.value : 0);
  // Editing an entry replaces its old cash effect, so add it back before
  // checking whether the new amount can be funded from Cash.
  const editingCashEffect = editingEntry?.affects_cash
    ? (editingEntry.entry_type === "sell" ? 1 : -1) *
      (editingEntry.cash_value ?? editingEntry.value)
    : 0;
  const availableCash =
    cash !== undefined ? cash.balance - editingCashEffect : undefined;
  const availableUnits =
    summary.units +
    (editingEntry?.entry_type === "sell" ? editingEntry.units : 0);
  const contributionLabel = isNPS
    ? "Invest"
    : isPPF
      ? "Add Money"
      : "Add Contribution";
  const dialogTitle = editingEntry
    ? "Edit Entry"
    : newEntryKind === "contribution"
      ? contributionLabel
      : newEntryKind === "interest"
        ? "Add Interest"
        : isNPS
          ? "Redeem"
          : "Withdraw";
  const dialogDescription = editingEntry
    ? "Update this retirement account entry."
    : isPPF
      ? newEntryKind === "contribution"
        ? "Money added is paid from your tracked Cash balance."
        : newEntryKind === "interest"
          ? "Interest is credited without touching Cash."
          : "The withdrawal is credited back to your tracked Cash balance."
      : isNPS
        ? "Enter units and NAV. Current value = units × latest NAV."
        : newEntryKind === "contribution"
          ? "Record the employee, employer and pension amounts from the EPFO passbook."
          : "Record a PF withdrawal from the passbook.";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/retirement" className="-ml-2 inline-flex">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to retirement
        </Button>
      </Link>

      <PageHeader
        title={asset.name}
        description={
          isPPF
            ? "A 15-year PPF account. Money added is paid from Cash, withdrawals go back to Cash, and interest is updated on 31 March. It counts in net worth, not in Total Portfolio or XIRR."
            : isNPS
              ? "NPS is market-linked like a mutual fund. Enter units and NAV; current value = units × latest NAV. It counts in net worth, not in Total Portfolio or XIRR."
              : "A retirement balance account. It counts in net worth, not in Total Portfolio or XIRR."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {isNPS ? (
            <>
              <Button onClick={() => openCreate("contribution")}>
                <Plus className="h-4 w-4" />
                Invest
              </Button>
              <Button
                variant="outline"
                onClick={() => openCreate("withdrawal")}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Redeem
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => openCreate("contribution")}>
                <Plus className="h-4 w-4" />
                {isPPF ? "Add Money" : "Add Contribution"}
              </Button>
              <Button variant="outline" onClick={() => openCreate("interest")}>
                <TrendingUp className="h-4 w-4" />
                Add Interest
              </Button>
              <Button
                variant="outline"
                onClick={() => openCreate("withdrawal")}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Withdraw
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      <RetirementSummaryCard summary={summary} assetType={asset.asset_type} />

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">Account history</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {sortedEntries.length}{" "}
              {sortedEntries.length === 1 ? "entry" : "entries"} ·{" "}
              {isPPF
                ? "money added, interest and withdrawals"
                : isNPS
                  ? "investments, redemptions and NAV"
                  : "contributions, interest and withdrawals"}
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
              <Landmark className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">
                {isPPF
                  ? "No entries yet. Use Add Money above to open the PPF account."
                  : "No entries yet. Use the actions above to add the first entry."}
              </p>
            </div>
          ) : isPF ? (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border/60 sm:-mx-6 sm:-mb-6">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold sm:px-5">Date</th>
                    <th className="px-4 py-3 font-semibold sm:px-5">Type</th>
                    <th className="px-4 py-3 text-right font-semibold">Employee</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Employer
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">Pension</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Interest / withdrawal
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 text-right font-semibold sm:px-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sortedEntries.map((entry) => {
                    const components = asPFComponents(entry.details);
                    const componentTotal = pfComponentsTotal(components);
                    const isContribution = entry.entry_type === "buy";
                    const isLegacy =
                      isContribution &&
                      componentTotal === 0 &&
                      entry.value > 0;
                    const other =
                      entry.entry_type === "interest"
                        ? entry.value
                        : entry.entry_type === "sell"
                          ? -entry.value
                          : null;
                    const total =
                      entry.entry_type === "sell" ? -entry.value : entry.value;

                    return (
                      <tr
                        key={entry.id}
                        className="group transition-colors hover:bg-muted/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <p className="font-medium">{formatDate(entry.date)}</p>
                          {entry.notes && (
                            <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                              {entry.notes}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={entryBadgeClass(entry)}>
                              {entryLabel(entry, asset.asset_type)}
                            </Badge>
                            {isLegacy && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                Legacy
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                          {isContribution && !isLegacy
                            ? formatCurrency(components.employee_share)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                          {isContribution && !isLegacy
                            ? formatCurrency(components.employer_share)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                          {isContribution && !isLegacy
                            ? formatCurrency(components.pension_share)
                            : "—"}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right tabular-nums",
                            other === null
                              ? "text-muted-foreground"
                              : other >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {other === null
                            ? "—"
                            : `${other >= 0 ? "+" : "−"}${formatCurrency(
                                Math.abs(other),
                              )}`}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums",
                            total >= 0
                              ? "text-foreground"
                              : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {total >= 0 ? "" : "−"}
                          {formatCurrency(Math.abs(total))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right sm:px-5">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : isNPS ? (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border/60 sm:-mx-6 sm:-mb-6">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold sm:px-5">Date</th>
                    <th className="px-4 py-3 font-semibold sm:px-5">Type</th>
                    <th className="px-4 py-3 text-right font-semibold">Units</th>
                    <th className="px-4 py-3 text-right font-semibold">NAV</th>
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
                    const isRedeem = entry.entry_type === "sell";
                    const rawNav = entry.details?.nav;
                    const nav =
                      typeof rawNav === "number"
                        ? rawNav
                        : Number(rawNav) || null;
                    const cashAmount = entry.affects_cash
                      ? (entry.cash_value ?? entry.value)
                      : null;
                    const cashEffect =
                      cashAmount === null
                        ? null
                        : isRedeem
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
                            {entryLabel(entry, asset.asset_type)}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">
                          {formatNumber(entry.units, 4)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                          {nav !== null ? formatCurrency(nav) : "—"}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums",
                            isRedeem
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {isRedeem ? "−" : "+"}
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border/60 sm:-mx-6 sm:-mb-6">
              <table className="w-full min-w-[720px] text-sm">
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
                    const isCredit = entry.entry_type !== "sell";
                    const cashAmount = entry.affects_cash
                      ? (entry.cash_value ?? entry.value)
                      : null;
                    const cashEffect =
                      cashAmount === null
                        ? null
                        : entry.entry_type === "sell"
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
                            {entryLabel(entry, asset.asset_type)}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums",
                            isCredit
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {isCredit ? "+" : "−"}
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
        open={dialogOpen}
        onClose={closeDialog}
        title={dialogTitle}
        description={dialogDescription}
      >
        <RetirementForm
          key={editingEntry?.id ?? `new-${newEntryKind}`}
          assetType={asset.asset_type}
          initial={editingEntry ?? undefined}
          defaultKind={newEntryKind}
          availableBalance={availableBalance}
          availableCash={isPPF ? availableCash : undefined}
          availableUnits={isNPS ? availableUnits : undefined}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={closeDialog}
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
            Removing this entry will recalculate the account balance and net
            worth.
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
