import { Wallet } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { formatCurrency } from "../lib/utils";

interface TotalValueCardProps {
  portfolioValue: number;
  assetCount: number;
}

export default function TotalValueCard({
  portfolioValue,
  assetCount,
}: TotalValueCardProps) {
  return (
    <Card className="group relative flex h-full flex-col overflow-hidden border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <CardContent className="relative flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Total Portfolio Value
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {formatCurrency(portfolioValue)}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
            <Wallet className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {assetCount} {assetCount === 1 ? "asset" : "assets"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Stocks, funds, FDs + PPF
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
