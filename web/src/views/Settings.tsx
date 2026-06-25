import { useEffect, useState } from "react";
import { ErrorView, LoadingView } from "../components/StateViews";
import { Spinner } from "../components/Spinner";
import {
  useConfig,
  useHealth,
  usePutConfig,
  usePutSettings,
  useSettings,
} from "../lib/queries";
import { useToast } from "../lib/toast";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Setup } from "./Setup";
import type {
  ConfigField,
  Settings as SettingsT,
} from "../lib/types";
import { providerLabel } from "../lib/presets";

export function Settings() {
  const q = useSettings();
  const save = usePutSettings();
  const health = useHealth();
  const toast = useToast();
  const { setAuthed } = useAuth();

  const [form, setForm] = useState<SettingsT | null>(null);

  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  if (q.isLoading) return <LoadingView label="Loading settings…" />;
  if (q.isError)
    return (
      <ErrorView
        message={q.error instanceof Error ? q.error.message : "Failed to load."}
        onRetry={() => q.refetch()}
      />
    );
  if (!form) return null;

  function set(key: keyof SettingsT, value: string) {
    const n = Number(value);
    setForm((f) => (f ? { ...f, [key]: Number.isNaN(n) ? 0 : n } : f));
  }

  function onSave() {
    if (!form) return;
    save.mutate(form, {
      onSuccess: () => toast.success("Settings saved."),
      onError: () => toast.error("Couldn't save settings."),
    });
  }

  async function onLogout() {
    try {
      await api.logout();
    } catch {
      /* ignore — we clear local state regardless */
    }
    setAuthed(false);
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-cream-400">
          Daily goals
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <GoalField
            label="Calories"
            unit="kcal"
            value={form.goal_kcal}
            onChange={(v) => set("goal_kcal", v)}
          />
          <GoalField
            label="Protein"
            unit="g"
            value={form.goal_protein_g}
            onChange={(v) => set("goal_protein_g", v)}
          />
          <GoalField
            label="Carbs"
            unit="g"
            value={form.goal_carbs_g}
            onChange={(v) => set("goal_carbs_g", v)}
          />
          <GoalField
            label="Fat"
            unit="g"
            value={form.goal_fat_g}
            onChange={(v) => set("goal_fat_g", v)}
          />
        </div>
        <button
          className="btn-primary mt-4 w-full"
          onClick={onSave}
          disabled={save.isPending}
        >
          {save.isPending && <Spinner className="h-4 w-4" />}
          Save goals
        </button>
      </section>

      <AutoSync />

      <Connection serverOk={!!health.data?.ok} serverLoading={health.isLoading} />

      <section className="card p-5">
        <button className="btn-ghost w-full" onClick={onLogout}>
          Log out
        </button>
      </section>

      <p className="pb-2 text-center text-xs text-cream-500">
        Oja{health.data?.version ? ` v${health.data.version}` : ""}
      </p>
    </div>
  );
}

/**
 * Connection section: shows live server/config status and the masked field
 * summary, with an expandable editor that reuses the setup wizard. Env-locked
 * fields are surfaced read-only by the wizard itself.
 */
function Connection({
  serverOk,
  serverLoading,
}: {
  serverOk: boolean;
  serverLoading: boolean;
}) {
  const cfg = useConfig();
  const [editing, setEditing] = useState(false);

  const fields = cfg.data?.fields;
  const configured = !!cfg.data?.configured;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cream-400">
          Connection
        </h2>
        {fields && (
          <button
            className="text-sm font-medium text-ember-400 hover:text-ember-300"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close" : "Edit"}
          </button>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <StatusRow
          label="Server"
          ok={serverOk}
          loading={serverLoading}
          okText="Online"
          badText="Unreachable"
        />
        <StatusRow
          label="Immich + vision"
          ok={configured}
          loading={cfg.isLoading}
          okText="Configured"
          badText="Not configured"
        />
      </div>

      {fields && !editing && (
        <dl className="mt-4 space-y-1.5 text-sm">
          <FieldRow label="Immich URL" f={fields.immich_url} />
          <FieldRow label="Immich API key" f={fields.immich_api_key} secret />
          <FieldRow label="Album" f={fields.immich_album} />
          <FieldRow
            label="Vision provider"
            f={{
              ...fields.vision_provider,
              value: providerLabel(
                fields.vision_provider.value,
                fields.vision_base_url.value,
              ),
            }}
          />
          <FieldRow label="Vision base URL" f={fields.vision_base_url} />
          <FieldRow label="Vision model" f={fields.vision_model} />
          <FieldRow label="Vision API key" f={fields.vision_api_key} secret />
        </dl>
      )}

      {editing && (
        <div className="mt-4 border-t border-ink-700 pt-4">
          <Setup
            embedded
            onDone={() => {
              setEditing(false);
              cfg.refetch();
            }}
          />
        </div>
      )}
    </section>
  );
}

function FieldRow({
  label,
  f,
  secret = false,
}: {
  label: string;
  f: ConfigField;
  secret?: boolean;
}) {
  let value: string;
  if (secret) value = f.set ? "•••• set" : "not set";
  else if (f.value) value = f.value;
  else value = f.set ? "set" : "not set";

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-cream-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-right text-cream-200">
          {value}
        </span>
        {f.locked && (
          <span className="chip shrink-0 bg-ink-700 text-cream-400" title="set by environment">
            🔒 env
          </span>
        )}
      </dd>
    </div>
  );
}

function GoalField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-cream-400">
        {label} <span className="text-cream-400/60">({unit})</span>
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
      />
    </label>
  );
}

function AutoSync() {
  const config = useConfig();
  const put = usePutConfig();
  const toast = useToast();
  const field = config.data?.fields.poll_interval_minutes;
  const [val, setVal] = useState("");
  useEffect(() => {
    if (field?.value != null) setVal(String(field.value));
  }, [field?.value]);

  if (config.isLoading || !field) return null;
  const n = Math.max(0, parseInt(val || "0", 10) || 0);

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-base font-semibold">Auto-sync</h2>
      <p className="mb-3 text-sm text-cream-400/80">
        How often Oja checks your album for new food photos. Set to 0 for manual
        sync only.
      </p>
      <label className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="field w-24"
          value={val}
          disabled={field.locked}
          onChange={(e) => setVal(e.target.value)}
        />
        <span className="text-sm text-cream-400">minutes</span>
        {!field.locked && (
          <button
            className="btn-primary ml-auto"
            disabled={put.isPending}
            onClick={() =>
              put.mutate(
                { poll_interval_minutes: String(n) },
                { onSuccess: () => toast.success("Auto-sync updated") },
              )
            }
          >
            {put.isPending && <Spinner className="h-4 w-4" />}
            Save
          </button>
        )}
      </label>
      <p className="mt-2 text-xs text-cream-400/60">
        {field.locked
          ? "🔒 Set by the POLL_INTERVAL_MINUTES environment variable."
          : n > 0
            ? `Currently every ${n} min — changes apply within a minute.`
            : "Auto-sync disabled — use “Sync now”."}
      </p>
    </section>
  );
}

function StatusRow({
  label,
  ok,
  loading,
  okText,
  badText,
}: {
  label: string;
  ok: boolean;
  loading: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-cream-300">{label}</span>
      {loading ? (
        <span className="text-cream-400">checking…</span>
      ) : (
        <span
          className={
            "chip " +
            (ok ? "bg-sage-500/15 text-sage-400" : "bg-berry-500/15 text-berry-400")
          }
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: ok ? "#7aa766" : "#cf4f6e" }}
          />
          {ok ? okText : badText}
        </span>
      )}
    </div>
  );
}
