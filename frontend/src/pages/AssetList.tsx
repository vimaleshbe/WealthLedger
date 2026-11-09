import { useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal, Wallet, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Dialog } from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";
import ErrorState from "../components/ErrorState";
import AssetCard from "../components/AssetCard";
import AssetForm from "../components/AssetForm";
import { AssetGridSkeleton } from "../components/PageSkeletons";
import { useAssets, useCreateAsset, useDeleteAsset } from "../api/assets";
import { useToast } from "../components/ui/toast";
import { ASSET_TYPES } from "../lib/assetTypes";
import type { Asset, AssetCreate, AssetType } from "../types";

export default function AssetList() {
  const { data: assets, isLoading, error, refetch } = useAssets();
  const createAsset = useCreateAsset();
  const deleteAsset = useDeleteAsset();
  const { success, error: showError } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AssetType>("all");
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (assets ?? []).filter((asset) => {
      const matchesType =
        typeFilter === "all" || asset.asset_type === typeFilter;
      const matchesQuery =
        !q ||
        asset.name.toLowerCase().includes(q) ||
        (asset.symbol ?? "").toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [assets, query, typeFilter]);

  const hasFilters = query.trim().length > 0 || typeFilter !== "all";

  const handleSubmit = (data: AssetCreate) => {
    createAsset.mutate(data, {
      onSuccess: () => {
        setIsModalOpen(false);
        success("Asset added successfully");
      },
      onError: (err: Error) => {
        showError(err.message || "Failed to add asset");
      },
    });
  };

  const handleDelete = (id: number) => {
    const asset = assets?.find((item) => item.id === id);
    setDeleteTarget(asset ?? null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAsset.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        success("Asset deleted successfully");
      },
      onError: (err: Error) => showError(err.message || "Failed to delete asset"),
    });
  };

  if (isLoading) return <AssetGridSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;

  const total = assets?.length ?? 0;

  return (
    <div className="relative min-h-[calc(100vh-12rem)] space-y-6">
      <PageHeader
        title="Assets"
        description="Every holding in one place — search, filter and manage your portfolio."
      >
        <Badge variant="outline" className="py-1">
          {total} {total === 1 ? "asset" : "assets"}
        </Badge>
        <Button className="hidden sm:inline-flex" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </PageHeader>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">No assets yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first stock, mutual fund, PPF, gold or property to start
            tracking your portfolio.
          </p>
          <Button className="mt-5" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or symbol…"
                className="pl-9 pr-9"
                aria-label="Search assets"
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

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-52">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as "all" | AssetType)
                  }
                  className="pl-9"
                  aria-label="Filter by asset type"
                >
                  <option value="all">All types</option>
                  {ASSET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-14 text-center">
              <Search className="h-8 w-8 text-muted-foreground/60" />
              <h3 className="mt-3 font-semibold">No matching assets</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term or clear the filters.
              </p>
              {hasFilters && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground">
                Showing {filteredAssets.length} of {total}
                {hasFilters ? " matching assets" : " assets"}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Button
        size="lg"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full p-0 shadow-xl shadow-primary/30 sm:hidden"
        onClick={() => setIsModalOpen(true)}
        aria-label="Add asset"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Asset"
        description="Track a new holding in your portfolio."
      >
        <AssetForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete asset?"
        description="This action cannot be undone."
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm text-foreground">
              You are about to delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span> and all
              of its entries.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteAsset.isPending}
            >
              {deleteAsset.isPending ? "Deleting…" : "Delete Asset"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
