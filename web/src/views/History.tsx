import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyView, ErrorView, LoadingView } from "../components/StateViews";
import { shortDay } from "../lib/date";
import { useHistory } from "../lib/queries";
import type { HistoryDay } from "../lib/types";

export function History() {
  const days = 30;
  const q = useHistory(days);

  if (q.isLoading) return <LoadingView label="Loading history…" />;
  if (q.isError)
    return (
      <ErrorView
        message={q.error instanceof Error ? q.error.message : "Failed to load."}
        onRetry={() => q.refetch()}
      />
    );
  if (!q.data) return null;

  const { days: rows, settings } = q.data;
  const logged = rows.filter((d) => d.meals > 0);

  if (logged.length === 0) {
    return (
      <EmptyView
        emoji="📊"
        title="No history yet"
        hint="Once you've logged a few days, your intake-vs-goal trend shows up here."
      />
    );
  }

  const avg = Math.round(
    logged.reduce((s, d) => s + d.kcal, 0) / logged.length,
  );
  const goal = settings.goal_kcal;

  const data = rows.map((d) => ({ ...d, label: shortDay(d.day) }));

  // Clean Y axis with round, evenly spaced gridlines so the goal line always
  // lands on one, with headroom above the tallest bar. (Recharts' auto integer
  // ticks produced a non-monotonic scale because the goal line sits well above
  // the logged values.)
  const peak = Math.max(goal, ...data.map((d) => d.kcal), 1);
  const step = peak < 2400 ? 500 : 1000;
  const niceMax = (Math.floor(peak / step) + 1) * step; // next round boundary above the peak
  const yTicks = Array.from({ length: niceMax / step + 1 }, (_, i) => i * step);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Avg / day" value={`${avg}`} unit="kcal" />
        <Stat
          label="Daily goal"
          value={`${goal}`}
          unit="kcal"
          tone={avg <= goal ? "good" : "over"}
        />
      </div>

      <div className="card p-3 pt-4">
        <div className="mb-2 px-1 text-sm font-medium text-cream-200">
          Last {days} days
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="#272320"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#a99a85", fontSize: 11 }}
                axisLine={{ stroke: "#352f2a" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#a99a85", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
                domain={[0, niceMax]}
                ticks={yTicks}
                allowDataOverflow
              />
              <Tooltip
                cursor={{ fill: "#ffffff08" }}
                contentStyle={{
                  background: "#1c1916",
                  border: "1px solid #352f2a",
                  borderRadius: 12,
                  color: "#f5ede3",
                }}
                labelStyle={{ color: "#a99a85" }}
                formatter={(v: number) => [`${Math.round(v)} kcal`, "Intake"]}
              />
              <ReferenceLine
                y={goal}
                stroke="#e58a3c"
                strokeDasharray="5 4"
                strokeWidth={1.5}
              />
              <Bar dataKey="kcal" radius={[4, 4, 0, 0]} maxBarSize={26}>
                {data.map((d, i) => (
                  <Cell key={i} fill={barColor(d, goal)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 px-1 text-xs text-cream-400">
          <span className="inline-block h-[2px] w-4 bg-ember-500" />
          goal {goal} kcal
        </div>
      </div>
    </div>
  );
}

function barColor(d: HistoryDay, goal: number): string {
  if (d.meals === 0) return "#272320";
  return d.kcal > goal * 1.05 ? "#cf4f6e" : "#7aa766";
}

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "good" | "over";
}) {
  const color =
    tone === "good"
      ? "text-sage-400"
      : tone === "over"
        ? "text-berry-400"
        : "text-cream-100";
  return (
    <div className="card p-4">
      <div className="text-xs text-cream-400">{label}</div>
      <div className={"mt-1 text-2xl font-semibold tabular-nums " + color}>
        {value} <span className="text-sm font-normal text-cream-400">{unit}</span>
      </div>
    </div>
  );
}
