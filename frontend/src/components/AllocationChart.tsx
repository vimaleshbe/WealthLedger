import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  categoryColor,
  formatCategory,
} from "../lib/categories";
import { formatCompactCurrency, formatCurrency } from "../lib/utils";
import type { AllocationItem } from "../types";

interface TooltipItem {
  payload?: AllocationItem;
}

function AllocationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipItem[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const name = item.category ?? item.asset_type ?? "Other";

  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-2 shadow-xl">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: categoryColor(name) }}
        />
        <span className="text-xs font-semibold">{formatCategory(name)}</span>
      </div>
      <p className="mt-1 text-sm font-bold tabular-nums">
        {formatCurrency(item.value)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {item.percentage.toFixed(1)}% of portfolio
      </p>
    </div>
  );
}

interface AllocationChartProps {
  data: AllocationItem[];
  title?: string;
}

export default function AllocationChart({
  data,
  title = "Allocation",
}: AllocationChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>How your portfolio is distributed</CardDescription>
          </div>
          <Badge variant="outline">{data.length} categories</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length === 0 ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
            <PieIcon className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Allocation appears once you add assets.
            </p>
          </div>
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="relative mx-auto h-[220px] w-full max-w-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={92}
                    paddingAngle={3}
                    cornerRadius={6}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {data.map((item, index) => {
                      const key = item.category ?? item.asset_type ?? String(index);
                      return (
                        <Cell key={`cell-${key}`} fill={categoryColor(key)} />
                      );
                    })}
                  </Pie>
                  <Tooltip content={<AllocationTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Total
                </span>
                <span className="mt-0.5 text-lg font-bold tracking-tight">
                  {formatCompactCurrency(total)}
                </span>
              </div>
            </div>

            <ul className="space-y-2.5">
              {data.map((item, index) => {
                const key = item.category ?? item.asset_type ?? String(index);
                return (
                  <li key={`legend-${key}`} className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColor(key) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {formatCategory(key)}
                    </span>
                    <span className="flex flex-col items-end leading-tight">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCompactCurrency(item.value)}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
