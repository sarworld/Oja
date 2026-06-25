import { useState } from "react";
import { CalorieRing } from "../components/CalorieRing";
import { MacroBar } from "../components/MacroBar";
import { MealCard } from "../components/MealCard";
import { Spinner } from "../components/Spinner";
import {
  EmptyView,
  ErrorView,
  LoadingView,
} from "../components/StateViews";
import { addDays, isToday, prettyDay, todayStr } from "../lib/date";
import { useDay, useSync } from "../lib/queries";
import { useToast } from "../lib/toast";
import { ApiError } from "../lib/api";

export function Today() {
  const [date, setDate] = useState(todayStr());
  const day = useDay(date);
  const sync = useSync();
  const toast = useToast();

  function runSync() {
    sync.mutate(undefined, {
      onSuccess: (r) => {
        const parts = [
          r.added ? `${r.added} added` : null,
          r.skipped ? `${r.skipped} skipped` : null,
          r.notfood ? `${r.notfood} not food` : null,
          r.errors ? `${r.errors} errors` : null,
        ].filter(Boolean);
        toast.success(
          r.added
            ? `Synced — ${parts.join(", ")}`
            : `Up to date${parts.length ? ` — ${parts.join(", ")}` : ""}`,
        );
      },
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409) {
          toast.error("A sync is already running.");
        } else {
          toast.error("Sync failed.");
        }
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <button
          aria-label="Previous day"
          className="btn-ghost h-10 w-10 !px-0"
          onClick={() => setDate((d) => addDays(d, -1))}
        >
          ‹
        </button>
        <div className="flex flex-col items-center">
          {/* Tap the date → native calendar. A transparent real <input type=date>
              overlays the label, which opens the picker reliably on iOS/Android
              (showPicker() on a hidden input is unreliable on Safari). */}
          <div className="relative" title="Pick a date">
            <div className="pointer-events-none flex flex-col items-center">
              <span className="text-base font-semibold">{prettyDay(date)}</span>
              <span className="text-xs text-cream-400">{date} ▾</span>
            </div>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Pick a date"
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
            />
          </div>
          {!isToday(date) && (
            <button
              className="mt-0.5 text-[11px] text-sage-400 underline-offset-2 hover:underline"
              onClick={() => setDate(todayStr())}
            >
              Jump to today
            </button>
          )}
        </div>
        <button
          aria-label="Next day"
          className="btn-ghost h-10 w-10 !px-0 disabled:opacity-30"
          onClick={() => setDate((d) => addDays(d, 1))}
          disabled={isToday(date)}
        >
          ›
        </button>
      </div>

      {day.isLoading && <LoadingView label="Loading your day…" />}
      {day.isError && (
        <ErrorView
          message={
            day.error instanceof Error ? day.error.message : "Failed to load."
          }
          onRetry={() => day.refetch()}
        />
      )}

      {day.data && (
        <>
          <Summary
            data={day.data}
            onSync={runSync}
            syncing={sync.isPending}
          />

          {day.data.entries.length === 0 ? (
            <EmptyView
              emoji="🥗"
              title="No food photos yet"
              hint="Drop one in your Immich album, then hit Sync now."
            >
              <button
                className="btn-primary mt-3"
                onClick={runSync}
                disabled={sync.isPending}
              >
                {sync.isPending && <Spinner className="h-4 w-4" />}
                Sync now
              </button>
            </EmptyView>
          ) : (
            <div className="space-y-3">
              {day.data.entries.map((e) => (
                <MealCard key={e.id} entry={e} date={date} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Summary({
  data,
  onSync,
  syncing,
}: {
  data: NonNullable<ReturnType<typeof useDay>["data"]>;
  onSync: () => void;
  syncing: boolean;
}) {
  const { totals, settings } = data;
  return (
    <div className="card p-5">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
        <CalorieRing value={totals.kcal} goal={settings.goal_kcal} />
        <div className="w-full flex-1 space-y-3">
          <MacroBar
            label="Protein"
            value={totals.protein_g}
            goal={settings.goal_protein_g}
            color="#9bbf8a"
          />
          <MacroBar
            label="Carbs"
            value={totals.carbs_g}
            goal={settings.goal_carbs_g}
            color="#f0a868"
          />
          <MacroBar
            label="Fat"
            value={totals.fat_g}
            goal={settings.goal_fat_g}
            color="#e0728a"
          />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm text-cream-400">
          {totals.meals} {totals.meals === 1 ? "meal" : "meals"}
        </span>
        <button
          className="btn-primary"
          onClick={onSync}
          disabled={syncing}
        >
          {syncing && <Spinner className="h-4 w-4" />}
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </div>
  );
}
