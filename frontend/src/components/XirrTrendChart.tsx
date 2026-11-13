import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { formatDate } from "../lib/utils";
import type { XirrHistoryPoint } from "../types";

interface XirrTooltipProps {
  active?: boolean;
  payload?: { payload?: XirrHistoryPoint }[];
}

function XirrTooltip({ active, payload }: XirrTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const value = point.xirr_percent;
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-2 shadow-xl">
      <p className="text-[11px] font-medium text-muted-foreground">
        {formatDate(point.date)}
      </p>
      <p
        className={
          value === null
            ? "mt-1 text-sm font-bold text-muted-foreground"
            : value >= 0
              ? "mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400"
              : "mt-1 text-sm font-bold text-rose-600 dark:text-rose-400"
        }
      >
        {value === null ? "N/A" : `${value.toFixed(2)}%`}
      </p>
    </div>
  );
}

interface XirrTrendChartProps {
  data: XirrHistoryPoint[];
  isLoading?: boolean;
}

export default function XirrTrendChart({
  data,
  isLoading = false,
}: XirrTrendChartProps) {
  const latest = [...data]
    .reverse()
    .find((point) => point.xirr_percent !== null);
  const hasValue = data.some((point) => point.xirr_percent !== null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">XIRR Trend</CardTitle>
          <CardDescription>Portfolio XIRR recorded daily</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">XIRR Trend</CardTitle>
            <CardDescription>Portfolio XIRR recorded daily</CardDescription>
          </div>
          {latest && latest.xirr_percent !== null && (
            <Badge
              variant="outline"
              className={
                latest.xirr_percent >= 0
                  ? "border-amber-500/30 bg-amber-500/10 tabular-nums text-amber-700 dark:text-amber-300"
                  : "border-rose-500/30 bg-rose-500/10 tabular-nums text-rose-700 dark:text-rose-300"
              }
            >
              {latest.xirr_percent.toFixed(2)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length === 0 || !hasValue ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              XIRR history appears after the first daily snapshot.
            </p>
          </div>
        ) : (
          <>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="xirrGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#f59e0b"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="#f59e0b"
                        stopOpacity={0.02}
                      />
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
                    tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    tickMargin={8}
                    width={48}
                    axisLine={false}
                    tickLine={false}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    content={<XirrTooltip />}
                    cursor={{
                      stroke: "#f59e0b",
                      strokeDasharray: "4 4",
                      strokeOpacity: 0.5,
                    }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="hsl(var(--border))"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="xirr_percent"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#xirrGradient)"
                    isAnimationActive={false}
                    connectNulls={false}
                    dot={
                      data.length === 1
                        ? { r: 4, fill: "#f59e0b", strokeWidth: 0 }
                        : false
                    }
                    activeDot={{
                      r: 5,
                      strokeWidth: 2,
                      stroke: "hsl(var(--card))",
                      fill: "#f59e0b",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {data.length < 2 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Daily history starts today. The trend will build as new
                snapshots are recorded.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
