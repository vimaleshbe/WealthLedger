import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  formatAxisCurrency,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
} from "../lib/utils";
import type { TrendPoint } from "../types";

interface TrendTooltipProps {
  active?: boolean;
  payload?: { payload?: TrendPoint }[];
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-2 shadow-xl">
      <p className="text-[11px] font-medium text-muted-foreground">
        {formatDate(point.date)}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums">
        {formatCurrency(point.total_value)}
      </p>
    </div>
  );
}

interface TrendChartProps {
  data: TrendPoint[];
}

export default function TrendChart({ data }: TrendChartProps) {
  const latest = data[data.length - 1];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Value Trend</CardTitle>
            <CardDescription>Portfolio value over time</CardDescription>
          </div>
          {latest && (
            <Badge variant="outline" className="tabular-nums">
              {formatCompactCurrency(latest.total_value)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length === 0 ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              Trend appears once entries are recorded.
            </p>
          </div>
        ) : (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="4 4"
                className="stroke-border/70"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) =>
                  new Date(value).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  })
                }
                tick={{ fontSize: 11, fill: "currentColor" }}
                tickMargin={10}
                minTickGap={28}
                axisLine={false}
                tickLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(value: number) => formatAxisCurrency(value)}
                tick={{ fontSize: 11, fill: "currentColor" }}
                tickMargin={8}
                width={50}
                axisLine={false}
                tickLine={false}
                className="text-muted-foreground"
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: "#6366f1", strokeDasharray: "4 4", strokeOpacity: 0.5 }}
              />
              <Area
                type="monotone"
                dataKey="total_value"
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#trendGradient)"
                isAnimationActive={false}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: "hsl(var(--card))",
                  fill: "#6366f1",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
