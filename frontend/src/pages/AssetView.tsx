import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Plus,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Trash2,
  Layers,
  Tag,
  StickyNote,
  Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import ErrorState from "../components/ErrorState";
import PageHeader from "../components/PageHeader";
import EntryForm from "../components/EntryForm";
import { AssetViewSkeleton } from "../components/PageSkeletons";
import {
  useAsset,
  useAssetValuation,
  useEntries,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
} from "../api/assets";
import { useToast } from "../components/ui/toast";
import { getAssetTypeLabel, getCategoryForAssetType } from "../lib/assetTypes";
import { categoryBadgeClass, formatCategory } from "../lib/categories";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
} from "../lib/utils";
import type { AssetEntry, EntryCreate } from "../types";

export default function AssetView() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const assetId = id ? parseInt(id, 10) : undefined;
  const { success, error: showError } = useToast();

  const {
    data: asset,
    isLoading: assetLoading,
    error: assetError,
    refetch: refetchAsset,
  } = useAsset(assetId);
  const { data: valuation, isLoading: valuationLoading } =
    useAssetValuation(assetId);
  const { data: entries, isLoading: entriesLoading } = useEntries(assetId);
  const createEntry = useCreateEntry(assetId ?? 0);
  const updateEntry = useUpdateEntry(assetId ?? 0);
  const deleteEntry = useDeleteEntry(assetId ?? 0);

  const [editingEntry, setEditingEntry] = useState<AssetEntry | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);

  const sortedEntries = entries
    ? [...entries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )
    : [];

  const handleEntrySubmit = (data: EntryCreate) => {
    if (editingEntry) {
      updateEntry.mutate(
        { entryId: editingEntry.id, data },
        {
          onSuccess: () => {
            setEditingEntry(null);
            success("Entry updated successfully");
          },
          onError: (err: Error) =>
            showError(err.message || "Failed to update entry"),
        },
      );
    } else {
      createEntry.mutate(data, {
        onSuccess: () => {
          setIsAddModalOpen(false);
          success("Entry added successfully");
        },
        onError: (err: Error) =>
          showError(err.message || "Failed to add entry"),
      });
    }
  };

  const confirmDeleteEntry = () => {
    if (deleteEntryId === null) return;
    deleteEntry.mutate(deleteEntryId, {
      onSuccess: () => {
        setDeleteEntryId(null);
        success("Entry deleted successfully");
      },
      onError: (err: Error) =>
        showError(err.message || "Failed to delete entry"),
    });
  };

  if (assetLoading) return <AssetViewSkeleton />;
  if (assetError || !asset) {
    return <ErrorState onRetry={refetchAsset} />;
  }

  const category = getCategoryForAssetType(asset.asset_type);
  const change = valuation?.change ?? 0;
  const changePercent = valuation?.change_percent ?? 0;
  const isPositive = change >= 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        onClick={() => navigate("/assets")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to assets
      </Button>

      <PageHeader
        title={asset.name}
        description="Holdings, valuation and full transaction history."
      >
        <Link to={`/assets/${asset.id}/edit`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4" />
            Edit Asset
          </Button>
        </Link>
      </PageHeader>

      <Card className="relative overflow-hidden border-border/70">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-emerald-500/[0.07]" />
        <CardContent className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Current Value
              </p>
              {valuationLoading ? (
                <Skeleton className="mt-2 h-9 w-48" />
              ) : (
                <p className="mt-1.5 text-3xl font-bold tracking-tight">
                  {formatCurrency(valuation?.current_value ?? 0)}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {valuationLoading ? (
                  <Skeleton className="h-6 w-40 rounded-full" />
                ) : (
                  <>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                        isPositive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
                      )}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {isPositive ? "+" : ""}
                      {changePercent.toFixed(2)}%
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {formatCurrency(change)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      overall gain
                    </span>
                  </>
                )}
              </div>
            </div>
            <Badge className={categoryBadgeClass(category)}>
              {getAssetTypeLabel(asset.asset_type)}
            </Badge>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Invested
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {valuationLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  formatCurrency(valuation?.invested_value ?? 0)
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Units
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {valuationLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  formatNumber(valuation?.total_units ?? 0, 3)
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Latest Price
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {valuationLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : valuation?.latest_price ? (
                  formatCurrency(valuation.latest_price)
                ) : (
                  "—"
                )}
              </p>
              {valuation?.price_source && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {valuation.price_source}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Layers className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Type
                </dt>
                <dd className="mt-0.5 font-medium">
                  {getAssetTypeLabel(asset.asset_type)}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Tag className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Category
                </dt>
                <dd className="mt-0.5 font-medium capitalize">{formatCategory(asset.category)}</dd>
              </div>
            </div>

            {asset.symbol && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Hash className="h-4 w-4" />
                </span>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Symbol
                  </dt>
                  <dd className="mt-0.5 font-medium">{asset.symbol}</dd>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Added on
                </dt>
                <dd className="mt-0.5 font-medium">{formatDate(asset.created_at)}</dd>
              </div>
            </div>

            {asset.notes && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <StickyNote className="h-4 w-4" />
                </span>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Notes
                  </dt>
                  <dd className="mt-0.5 font-medium">{asset.notes}</dd>
                </div>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">History</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {sortedEntries.length}{" "}
              {sortedEntries.length === 1 ? "entry" : "entries"} recorded
            </p>
          </div>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 py-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">
                No entries yet. Add the first purchase to start tracking.
              </p>
              <Button
                className="mt-4"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add First Entry
              </Button>
            </div>
          ) : (
            <ol className="space-y-0">
              {sortedEntries.map((entry, index) => (
                <li key={entry.id} className="group flex gap-3">
                  <div className="flex flex-col items-center pt-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-primary bg-background" />
                    {index < sortedEntries.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="mb-2 flex flex-1 flex-col gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border/70 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(entry.value)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(entry.date)} ·{" "}
                        {formatNumber(entry.units, 3)} units
                        {entry.notes ? ` · ${entry.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingEntry(entry)}
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
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Entry"
        description="Record a purchase or contribution."
      >
        <EntryForm
          onSubmit={handleEntrySubmit}
          onCancel={() => setIsAddModalOpen(false)}
        />
      </Dialog>

      <Dialog
        open={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        title="Edit Entry"
        description="Update the details of this entry."
      >
        {editingEntry && (
          <EntryForm
            key={editingEntry.id}
            initial={editingEntry}
            onSubmit={handleEntrySubmit}
            onCancel={() => setEditingEntry(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={deleteEntryId !== null}
        onClose={() => setDeleteEntryId(null)}
        title="Delete entry?"
        description="This action cannot be undone."
      >
        <div className="space-y-5">
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            Removing this entry will change the asset&apos;s invested value and
            history.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteEntryId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteEntry}
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
