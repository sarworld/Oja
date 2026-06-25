import type { ReactNode } from "react";
import { Spinner } from "./Spinner";

export function LoadingView({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-cream-400">
      <Spinner className="h-7 w-7 text-ember-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-14 text-center">
      <div className="text-3xl">⚠️</div>
      <p className="text-sm text-cream-300">{message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyView({
  emoji = "🍽️",
  title,
  hint,
  children,
}: {
  emoji?: string;
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-14 text-center">
      <div className="text-4xl">{emoji}</div>
      <p className="font-medium text-cream-200">{title}</p>
      {hint && <p className="text-sm text-cream-400">{hint}</p>}
      {children}
    </div>
  );
}
