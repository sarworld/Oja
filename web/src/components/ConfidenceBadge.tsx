import type { Confidence } from "../lib/types";

const styles: Record<Confidence, string> = {
  high: "bg-sage-500/15 text-sage-400",
  medium: "bg-ember-500/15 text-ember-400",
  low: "bg-berry-500/15 text-berry-400",
};

export function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span className={"chip " + (styles[value] ?? styles.medium)}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor:
            value === "high"
              ? "#7aa766"
              : value === "low"
                ? "#cf4f6e"
                : "#e58a3c",
        }}
      />
      {value}
    </span>
  );
}
