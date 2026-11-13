import { Link } from "react-router-dom";
import { Eye, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { getAssetTypeLabel, getCategoryForAssetType } from "../lib/assetTypes";
import { categoryBadgeClass } from "../lib/categories";
import { goldPurityLabel, normalizeGoldPurity } from "../lib/gold";
import { useAssetValuation } from "../api/assets";
import { cn, formatCompactCurrency, formatCurrency } from "../lib/utils";
import type { Asset } from "../types";

interface AssetCardProps {
  asset: Asset;
  onDelete: (id: number) => void;
}

export default function AssetCard({ asset, onDelete }: AssetCardProps) {
  const { data: valuation, isLoading } = useAssetValuation(asset.id);

  const change = valuation?.change ?? 0;
  const changePercent = valuation?.change_percent ?? 0;
  const isPositive = change >= 0;
  const category = getCategoryForAssetType(asset.asset_type);
  const isGold = asset.asset_type === "physical_gold";
  const goldPurity = normalizeGoldPurity(
    asset.gold_purity ?? asset.details?.purity,
  );

  return (
    <Card className="group relative flex flex-col overflow-hidden border-border/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-semibold sm:text-[17px]">
              {asset.name}
            </CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge className={categoryBadgeClass(category)}>
                {getAssetTypeLabel(asset.asset_type)}
              </Badge>
              {isGold ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {goldPurityLabel(goldPurity)}
                </span>
              ) : (
                asset.symbol && (
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {asset.symbol}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-background/60 p-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Link to={`/assets/${asset.id}`} aria-label={`View ${asset.name}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <Link to={`/assets/${asset.id}/edit`} aria-label={`Edit ${asset.name}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(asset.id)}
              aria-label={`Delete ${asset.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="mt-auto pt-0">
        {asset.notes && (
          <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
            {asset.notes}
          </p>
        )}

        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Invested
              </p>
              <p className="mt-1 truncate text-sm font-semibold tabular-nums">
                {isLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  formatCurrency(valuation?.invested_value ?? 0)
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Current
              </p>
              <p className="mt-1 truncate text-sm font-semibold tabular-nums">
                {isLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  formatCurrency(valuation?.current_value ?? 0)
                )}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                isLoading
                  ? "bg-muted text-muted-foreground"
                  : isPositive
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
              )}
            >
              {isLoading ? (
                <Skeleton className="h-3 w-12" />
              ) : (
                <>
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {changePercent.toFixed(2)}%
                </>
              )}
            </span>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                isLoading
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
              )}
            >
              {isLoading
                ? "—"
                : `${isPositive ? "+" : ""}${formatCompactCurrency(change)}`}
            </span>
          </div>
        </div>

        {valuation?.latest_price ? (
          <p className="mt-2.5 truncate text-[11px] text-muted-foreground">
            {isGold ? `${goldPurityLabel(goldPurity)} rate` : "Latest price"}{" "}
            {formatCurrency(valuation.latest_price)}
            {isGold ? "/g" : ""}
            {valuation.price_source ? ` · ${valuation.price_source}` : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
