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
import { categoryColor, formatCategory } from "../lib/categories";
import { getAssetTypeLabel } from "../lib/assetTypes";
import { formatCompactCurrency, formatCurrency } from "../lib/utils";
import type { AllocationItem, AssetType } from "../types";

const CHART_PALETTE = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
  "#0891b2",
  "#8b5cf6",
  "#f43f5e",
  "#0ea5e9",
  "#84cc16",
  "#d946ef",
  "#64748b",
  "#14b8a6",
  "#f97316",
];

interface ChartItem extends AllocationItem {
  label: string;
  color: string;
}

function itemLabel(item: AllocationItem): string {
  if (item.name) return item.name;
  if (item.asset_type) {
    return getAssetTypeLabel(item.asset_type as AssetType);
  }
  return formatCategory(item.category);
}

interface TooltipItem {
  payload?: ChartItem;
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

  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-2 shadow-xl">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-xs font-semibold">{item.label}</span>
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
  const chartData: ChartItem[] = data.map((item, index) => ({
    ...item,
    label: itemLabel(item),
    color: item.category
      ? categoryColor(item.category)
      : CHART_PALETTE[index % CHART_PALETTE.length],
  }));
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>How your portfolio is distributed</CardDescription>
          </div>
          <Badge variant="outline">{chartData.length} categories</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {chartData.length === 0 || total <= 0 ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
            <PieIcon className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Allocation appears once you add assets or cash.
            </p>
          </div>
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="relative mx-auto h-[220px] w-full max-w-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={92}
                    paddingAngle={3}
                    cornerRadius={6}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {chartData.map((item, index) => (
                      <Cell
                        key={`cell-${item.label}-${index}`}
                        fill={item.color}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<AllocationTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Net worth
                </span>
                <span className="mt-0.5 text-lg font-bold tracking-tight">
                  {formatCompactCurrency(total)}
                </span>
              </div>
            </div>

            <ul className="max-h-[240px] space-y-2.5 overflow-y-auto pr-1">
              {chartData.map((item, index) => (
                <li
                  key={`legend-${item.label}-${index}`}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {item.label}
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
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
