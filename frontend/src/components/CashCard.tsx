import { Link } from "react-router-dom";
import { Banknote, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { formatCurrency } from "../lib/utils";

interface CashCardProps {
  cashValue: number;
  cashAssetId: number | null;
}

export default function CashCard({ cashValue, cashAssetId }: CashCardProps) {
  const card = (
    <Card className="group relative overflow-hidden border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-teal-500/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Cash
            </p>
            <p className="mt-3 truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {formatCurrency(cashValue)}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-inset ring-teal-500/10 dark:text-teal-400">
            <Banknote className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300"
          >
            Available to invest
          </Badge>
          {cashAssetId && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
              Manage cash
              <ArrowUpRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!cashAssetId) return card;

  return (
    <Link to={`/assets/${cashAssetId}`} className="block">
      {card}
    </Link>
  );
}
