interface Props {
  label: string;
  value: number;
  goal: number;
  color: string;
}

export function MacroBar({ label, value, goal, color }: Props) {
  const safeGoal = goal > 0 ? goal : 1;
  const pct = Math.min(value / safeGoal, 1) * 100;
  const over = value > goal;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-cream-300">{label}</span>
        <span className="tabular-nums text-cream-400">
          <span className={over ? "text-ember-400" : "text-cream-200"}>
            {Math.round(value)}
          </span>
          <span className="text-cream-400/70"> / {Math.round(goal)} g</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
