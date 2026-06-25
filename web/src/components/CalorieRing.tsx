interface Props {
  value: number;
  goal: number;
  size?: number;
}

/** Color shifts green → amber → red as you approach and exceed the goal. */
function ringColor(ratio: number): string {
  if (ratio <= 0.75) return "#7aa766"; // sage
  if (ratio <= 0.95) return "#9bbf8a";
  if (ratio <= 1.05) return "#f0a868"; // ember
  if (ratio <= 1.2) return "#e58a3c";
  return "#cf4f6e"; // berry — over
}

export function CalorieRing({ value, goal, size = 168 }: Props) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeGoal = goal > 0 ? goal : 1;
  const ratio = value / safeGoal;
  const pct = Math.min(ratio, 1);
  const color = ringColor(ratio);
  const remaining = goal - value;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} of ${goal} kcal`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#272320"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .5s ease, stroke .3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-semibold tabular-nums leading-none"
          style={{ color }}
        >
          {Math.round(value)}
        </span>
        <span className="mt-1 text-xs text-cream-400">/ {goal} kcal</span>
        <span className="mt-2 text-xs font-medium text-cream-300">
          {remaining >= 0
            ? `${Math.round(remaining)} left`
            : `${Math.round(-remaining)} over`}
        </span>
      </div>
    </div>
  );
}
