import { useState, type FormEvent } from "react";
import { photoUrl } from "../lib/api";
import type { Entry } from "../lib/types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Spinner } from "./Spinner";
import { useToast } from "../lib/toast";
import {
  useChat,
  useDeleteEntry,
  usePatchEntry,
  useReanalyze,
  useToggle,
} from "../lib/queries";

export function MealCard({ entry, date }: { entry: Entry; date: string }) {
  const [expanded, setExpanded] = useState(false);
  const toast = useToast();

  const toggle = useToggle(date);

  function onToggle() {
    toggle.mutate(entry.id, {
      onError: () => toast.error("Couldn't update — try again."),
    });
  }

  return (
    <div
      className={
        "card overflow-hidden transition-opacity " +
        (entry.included ? "" : "opacity-50")
      }
    >
      <div className="flex gap-3 p-3">
        <Thumb entry={entry} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-medium leading-tight text-cream-100">
                {entry.dish || "Unnamed meal"}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ConfidenceBadge value={entry.confidence} />
                {entry.edited && (
                  <span className="chip bg-ink-700 text-cream-400">edited</span>
                )}
                {entry.source !== "auto" && (
                  <span className="chip bg-ink-700 text-cream-400">
                    {entry.source}
                  </span>
                )}
                {entry.source_missing && (
                  <span
                    className="chip"
                    style={{ background: "#f0a86822", color: "#f0a868" }}
                    title="This photo is no longer in your source album. The entry was kept — delete it here to remove it."
                  >
                    ⚠ removed from source
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold tabular-nums text-cream-100">
                {Math.round(entry.kcal)}
              </div>
              <div className="text-[11px] text-cream-400">kcal</div>
            </div>
          </div>

          <MacroLine entry={entry} />
        </div>
      </div>

      {/* Per-item breakdown */}
      {entry.items?.length > 0 && (
        <div className="border-t border-ink-700 px-3 py-2">
          <ul className="space-y-1">
            {entry.items.map((it, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate text-cream-300">{it.name}</span>
                <span className="shrink-0 tabular-nums text-cream-400">
                  {Math.round(it.kcal)} kcal
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t border-ink-700 px-3 py-2">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-cream-300">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={entry.included}
            onChange={onToggle}
            disabled={toggle.isPending}
          />
          <span className="relative h-5 w-9 rounded-full bg-ink-600 transition-colors peer-checked:bg-sage-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-cream-100 after:transition-transform peer-checked:after:translate-x-4" />
          {entry.included ? "Counted" : "Excluded"}
        </label>
        <button
          className="ml-auto text-sm font-medium text-ember-400 hover:text-ember-300"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Close" : "Edit"}
        </button>
      </div>

      {expanded && <Editor entry={entry} date={date} />}
    </div>
  );
}

function Thumb({ entry }: { entry: Entry }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-700">
      {failed ? (
        <div className="flex h-full w-full items-center justify-center text-2xl">
          🍽️
        </div>
      ) : (
        <img
          src={photoUrl(entry.immich_asset_id, "thumbnail")}
          alt={entry.dish}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function MacroLine({ entry }: { entry: Entry }) {
  return (
    <div className="mt-2 flex gap-3 text-[11px] text-cream-400">
      <Macro label="P" value={entry.protein_g} color="#9bbf8a" />
      <Macro label="C" value={entry.carbs_g} color="#f0a868" />
      <Macro label="F" value={entry.fat_g} color="#e0728a" />
    </div>
  );
}

function Macro({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="tabular-nums text-cream-300">
        {Math.round(value || 0)}g
      </span>
      <span className="text-cream-400/70">{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------

function Editor({ entry, date }: { entry: Entry; date: string }) {
  const toast = useToast();
  const reanalyze = useReanalyze(date);
  const patch = usePatchEntry(date);
  const chat = useChat(date);
  const del = useDeleteEntry(date);

  const [desc, setDesc] = useState(entry.notes ?? "");
  const [dish, setDish] = useState(entry.dish ?? "");
  const [kcal, setKcal] = useState(String(entry.kcal ?? ""));
  const [protein, setProtein] = useState(String(entry.protein_g ?? ""));
  const [carbs, setCarbs] = useState(String(entry.carbs_g ?? ""));
  const [fat, setFat] = useState(String(entry.fat_g ?? ""));

  const [message, setMessage] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  function onReanalyze() {
    reanalyze.mutate(
      { id: entry.id, text: desc.trim() || undefined },
      {
        onSuccess: (e) => toast.success(`Re-analyzed: ${e.dish}`),
        onError: () => toast.error("Re-analyze failed."),
      },
    );
  }

  function num(s: string): number | undefined {
    const n = Number(s);
    return s.trim() === "" || Number.isNaN(n) ? undefined : n;
  }

  function onSave() {
    patch.mutate(
      {
        id: entry.id,
        patch: {
          dish: dish.trim(),
          notes: desc.trim(),
          kcal: num(kcal),
          protein_g: num(protein),
          carbs_g: num(carbs),
          fat_g: num(fat),
        },
      },
      {
        onSuccess: () => toast.success("Saved."),
        onError: () => toast.error("Save failed."),
      },
    );
  }

  function onChat(e: FormEvent) {
    e.preventDefault();
    const m = message.trim();
    if (!m) return;
    chat.mutate(
      { id: entry.id, message: m },
      {
        onSuccess: (r) => {
          setMessage("");
          // Re-sync local edit fields with the refreshed numbers.
          setDish(r.entry.dish ?? "");
          setKcal(String(r.entry.kcal ?? ""));
          setProtein(String(r.entry.protein_g ?? ""));
          setCarbs(String(r.entry.carbs_g ?? ""));
          setFat(String(r.entry.fat_g ?? ""));
        },
        onError: () => toast.error("Chat failed."),
      },
    );
  }

  function onDelete() {
    del.mutate(entry.id, {
      onSuccess: () => toast.success("Deleted."),
      onError: () => toast.error("Delete failed."),
    });
  }

  return (
    <div className="space-y-5 border-t border-ink-700 bg-ink-900/40 p-4">
      {/* Description + reanalyze */}
      <section className="space-y-2">
        <Label>Description (for re-analysis)</Label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          placeholder="e.g. double portion, no rice, whole milk latte"
          className="field resize-none"
        />
        <button
          className="btn-ghost w-full"
          onClick={onReanalyze}
          disabled={reanalyze.isPending}
        >
          {reanalyze.isPending && <Spinner className="h-4 w-4" />}
          Re-analyze photo
        </button>
      </section>

      {/* Manual edit */}
      <section className="space-y-2">
        <Label>Manual edit</Label>
        <input
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          placeholder="Dish name"
          className="field"
        />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="kcal" value={kcal} onChange={setKcal} />
          <NumField label="Protein (g)" value={protein} onChange={setProtein} />
          <NumField label="Carbs (g)" value={carbs} onChange={setCarbs} />
          <NumField label="Fat (g)" value={fat} onChange={setFat} />
        </div>
        <button
          className="btn-primary w-full"
          onClick={onSave}
          disabled={patch.isPending}
        >
          {patch.isPending && <Spinner className="h-4 w-4" />}
          Save changes
        </button>
      </section>

      {/* Chat */}
      <section className="space-y-2">
        <Label>Talk it through</Label>
        {entry.chat && entry.chat.length > 0 && (
          <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl bg-ink-800 p-2">
            {entry.chat.map((t, i) => (
              <div
                key={i}
                className={
                  "rounded-lg px-2.5 py-1.5 text-sm " +
                  (t.role === "user"
                    ? "ml-6 bg-ember-500/10 text-cream-100"
                    : "mr-6 bg-ink-700 text-cream-200")
                }
              >
                {t.text}
              </div>
            ))}
          </div>
        )}
        <form onSubmit={onChat} className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="It was a double portion, no rice…"
            className="field"
          />
          <button
            type="submit"
            className="btn-ghost shrink-0"
            disabled={chat.isPending || !message.trim()}
          >
            {chat.isPending ? <Spinner className="h-4 w-4" /> : "Send"}
          </button>
        </form>
      </section>

      {/* Delete */}
      <section className="border-t border-ink-700 pt-3">
        {confirmDel ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-cream-300">Delete this meal?</span>
            <button
              className="btn-danger ml-auto"
              onClick={onDelete}
              disabled={del.isPending}
            >
              {del.isPending && <Spinner className="h-4 w-4" />}
              Delete
            </button>
            <button
              className="btn-ghost"
              onClick={() => setConfirmDel(false)}
              disabled={del.isPending}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="text-sm font-medium text-berry-400 hover:text-berry-300"
            onClick={() => setConfirmDel(true)}
          >
            Delete meal
          </button>
        )}
      </section>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-cream-400">
      {children}
    </h4>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-cream-400">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
      />
    </label>
  );
}
