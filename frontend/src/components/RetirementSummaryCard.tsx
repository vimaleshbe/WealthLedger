import {
  Building2,
  Hash,
  Hourglass,
  Info,
  Landmark,
  Layers,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { isMatured } from "../lib/retirement";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  todayISO,
} from "../lib/utils";
import type { AssetType, RetirementSummary } from "../types";

function Tile({
  icon,
  label,
  value,
  valueText,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  valueText?: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className={accent}>{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums">
        {valueText ?? formatCurrency(value ?? 0)}
      </p>
    </div>
  );
}

export default function RetirementSummaryCard({
  summary,
  assetType,
}: {
  summary: RetirementSummary;
  assetType: AssetType;
}) {
  const isPF = assetType === "pf";
  const isNPS = assetType === "nps";

  return (
    <Card className="relative overflow-hidden border-border/70">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-emerald-500/[0.07]" />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {isNPS ? "NPS Value" : `${assetType.toUpperCase()} Balance`}
            </p>
            <p className="mt-1.5 text-3xl font-bold tracking-tight">
              {formatCurrency(summary.balance)}
            </p>
            <p className="mt-2.5 text-xs text-muted-foreground">
              {isNPS
                ? "Units × latest NAV"
                : "Contributions + interest − withdrawals"}
            </p>
          </div>
          <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            <Landmark className="mr-1 h-3.5 w-3.5" />
            {assetType.toUpperCase()}
          </Badge>
        </div>

        {isPF ? (
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-5 sm:grid-cols-4">
            <Tile
              icon={<User className="h-3.5 w-3.5" />}
              label="Employee"
              value={summary.employee_total}
            />
            <Tile
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Employer"
              value={summary.employer_total}
            />
            <Tile
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="Pension (EPS)"
              value={summary.pension_total}
              accent="text-amber-600 dark:text-amber-400"
            />
            <Tile
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Interest"
              value={summary.interest_total}
              accent="text-emerald-600 dark:text-emerald-400"
            />
          </div>
        ) : isNPS ? (
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-5 sm:grid-cols-4">
            <Tile
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Invested"
              value={summary.invested_value}
            />
            <Tile
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Gain"
              value={summary.gain}
              accent={
                summary.gain >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }
            />
            <Tile
              icon={<Hash className="h-3.5 w-3.5" />}
              label="Latest NAV"
              valueText={
                summary.latest_nav !== null
                  ? formatCurrency(summary.latest_nav)
                  : "—"
              }
            />
            <Tile
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Units"
              valueText={formatNumber(summary.units, 4)}
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border/60 pt-5">
            <Tile
              icon={<Wallet className="h-3.5 w-3.5" />}
              label={assetType === "ppf" ? "Money added" : "Contributions"}
              value={summary.contributions}
            />
            <Tile
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Interest / growth"
              value={summary.interest_total}
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <Tile
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="Withdrawals"
              value={summary.withdrawal_total}
              accent="text-rose-600 dark:text-rose-400"
            />
          </div>
        )}

        {assetType === "ppf" && summary.maturity_date && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Hourglass className="h-3.5 w-3.5 shrink-0" />
            <span>
              Maturity:{" "}
              <span className="font-semibold text-foreground">
                {formatDate(summary.maturity_date)}
              </span>{" "}
              ·{" "}
              {isMatured(summary.maturity_date, todayISO())
                ? "Matured (15-year term complete)"
                : "15-year term from the first contribution"}
            </span>
          </p>
        )}

        {summary.unclassified_total > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Legacy / unclassified PF contributions:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(summary.unclassified_total)}
            </span>
          </p>
        )}

        <p className="mt-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This account counts in net worth. It is not included in Total
            Portfolio or XIRR.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
