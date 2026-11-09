import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

interface XirrCardProps {
  xirrPercent: number | null | undefined;
}

export default function XirrCard({ xirrPercent }: XirrCardProps) {
  const isNeutral = xirrPercent === null || xirrPercent === undefined;
  const isPositive = !isNeutral && xirrPercent >= 0;
  const isNegative = !isNeutral && xirrPercent < 0;

  const displayValue = isNeutral
    ? "N/A"
    : `${isPositive ? "+" : ""}${xirrPercent.toFixed(2)}%`;

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <Card className="group relative overflow-hidden border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/5">
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125",
          isPositive
            ? "bg-emerald-500/10"
            : isNegative
              ? "bg-red-500/10"
              : "bg-slate-500/10",
        )}
      />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Portfolio XIRR
            </p>
            <p
              className={cn(
                "mt-3 text-2xl font-bold tracking-tight sm:text-3xl",
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : isNegative
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground",
              )}
            >
              {displayValue}
            </p>
          </div>
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
              isPositive
                ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/10 dark:text-emerald-400"
                : isNegative
                  ? "bg-red-500/10 text-red-600 ring-red-500/10 dark:text-red-400"
                  : "bg-muted text-muted-foreground ring-border",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">Money-weighted</Badge>
          <span className="text-xs text-muted-foreground">
            Stocks + Mutual Funds only
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
