import { Link } from "react-router-dom";
import { ArrowUpRight, Landmark } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { formatCurrency } from "../lib/utils";

export default function RetirementCard({
  retirementValue,
}: {
  retirementValue: number;
}) {
  return (
    <Link to="/retirement" className="block h-full">
      <Card className="group relative flex h-full flex-col overflow-hidden border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-500/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
        <CardContent className="relative flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Retirement
              </p>
              <p className="mt-3 truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {formatCurrency(retirementValue)}
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/10 dark:text-amber-400">
              <Landmark className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              PF · PPF · NPS
            </Badge>
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
              Net worth only
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
