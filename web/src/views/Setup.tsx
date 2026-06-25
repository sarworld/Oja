import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../components/Spinner";
import { api, ApiError } from "../lib/api";
import { useConfig, usePutConfig } from "../lib/queries";
import { useToast } from "../lib/toast";
import { presetById, VISION_PRESETS } from "../lib/presets";
import type {
  ConfigResponse,
  ImmichAlbum,
  TestImmichResult,
  TestVisionResult,
} from "../lib/types";

type Step = 1 | 2 | 3;

/**
 * Multi-step first-run setup wizard.
 *
 * Step 1 Immich → test + load albums → pick album.
 * Step 2 Vision → preset dropdown auto-fills base URL + model → test.
 * Step 3 Review → save → onDone() (parent re-checks health and shows dashboard).
 *
 * Env-locked fields (from GET /api/config) render read-only with a note and are
 * never sent on save. Secrets are write-only: we show "set"/"not set", never the value.
 */
export function Setup({
  onDone,
  embedded = false,
}: {
  onDone?: () => void;
  embedded?: boolean;
}) {
  const cfg = useConfig();
  const fields = cfg.data?.fields;

  const [step, setStep] = useState<Step>(1);

  // Immich
  const [immichUrl, setImmichUrl] = useState("");
  const [immichKey, setImmichKey] = useState("");
  const [album, setAlbum] = useState("");
  const [albums, setAlbums] = useState<ImmichAlbum[]>([]);

  // Vision
  const [presetId, setPresetId] = useState("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [visionKey, setVisionKey] = useState("");
  const [model, setModel] = useState("");

  // Seed from any already-saved (non-secret) values once config loads.
  // Fall back to the selected preset's defaults so the vision step isn't blank.
  useEffect(() => {
    if (!fields) return;
    const p = presetById(fields.vision_provider.value || "openai");
    setImmichUrl((v) => v || fields.immich_url.value || "");
    setAlbum((v) => v || fields.immich_album.value || "");
    setPresetId((v) => fields.vision_provider.value || v);
    setBaseUrl((v) => v || fields.vision_base_url.value || p.base_url);
    setModel(
      (v) => v || fields.vision_model.value || p.models[0] || "",
    );
  }, [fields]);

  const preset = useMemo(() => presetById(presetId), [presetId]);

  function onPickPreset(id: string) {
    setPresetId(id);
    const p = presetById(id);
    // Auto-fill base URL + first model suggestion.
    setBaseUrl(p.base_url);
    if (p.models.length > 0) setModel(p.models[0]);
  }

  function next() {
    setStep((s) => (Math.min(3, s + 1) as Step));
  }
  function back() {
    setStep((s) => (Math.max(1, s - 1) as Step));
  }

  if (cfg.isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-16 text-cream-400">
        <Spinner className="h-7 w-7 text-ember-500" />
      </div>
    );
  }

  const inner = (
    <div className="w-full max-w-md">
      {!embedded && (
        <div className="mb-6 text-center">
          <div className="text-5xl">🍲</div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Set up Oja
          </h1>
          <p className="mt-1 text-sm text-cream-400">
            Connect your Immich library and a vision model.
          </p>
        </div>
      )}

      <Stepper step={step} />

      <div className="card mt-4 p-5">
        {step === 1 && (
          <ImmichStep
            url={immichUrl}
            setUrl={setImmichUrl}
            apiKey={immichKey}
            setApiKey={setImmichKey}
            album={album}
            setAlbum={setAlbum}
            albums={albums}
            setAlbums={setAlbums}
            fields={fields}
            onNext={next}
          />
        )}
        {step === 2 && (
          <VisionStep
            presetId={presetId}
            onPickPreset={onPickPreset}
            baseUrl={baseUrl}
            setBaseUrl={setBaseUrl}
            apiKey={visionKey}
            setApiKey={setVisionKey}
            model={model}
            setModel={setModel}
            providerLabel={preset.label}
            local={!!preset.local}
            note={preset.note}
            fields={fields}
            onBack={back}
            onNext={next}
          />
        )}
        {step === 3 && (
          <SaveStep
            immichUrl={immichUrl}
            immichKey={immichKey}
            album={album}
            presetId={presetId}
            providerKind={preset.provider}
            baseUrl={baseUrl}
            visionKey={visionKey}
            model={model}
            fields={fields}
            onBack={back}
            onDone={onDone}
          />
        )}
      </div>
    </div>
  );

  if (embedded) return inner;
  return (
    <div className="flex min-h-full items-center justify-center px-5 py-10">
      {inner}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ step }: { step: Step }) {
  const labels = ["Immich", "Vision", "Save"];
  return (
    <ol className="flex items-center gap-2">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                (active
                  ? "bg-ember-500 text-ink-900"
                  : done
                    ? "bg-sage-500/20 text-sage-400"
                    : "bg-ink-700 text-cream-400")
              }
            >
              {done ? "✓" : n}
            </span>
            <span
              className={
                "text-xs font-medium " +
                (active ? "text-cream-100" : "text-cream-400")
              }
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span className="h-px flex-1 bg-ink-700" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function LockedNote() {
  return (
    <p className="mt-1 text-[11px] text-cream-400/80">set by environment</p>
  );
}

function SecretStatus({ set }: { set: boolean }) {
  return (
    <span className="text-[11px] text-cream-400">
      {set ? "•••• set" : "not set"}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-cream-300">
      {children}
    </span>
  );
}

function errText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

// ---------------------------------------------------------------------------
// Step 1 — Immich

function ImmichStep({
  url,
  setUrl,
  apiKey,
  setApiKey,
  album,
  setAlbum,
  albums,
  setAlbums,
  fields,
  onNext,
}: {
  url: string;
  setUrl: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  album: string;
  setAlbum: (v: string) => void;
  albums: ImmichAlbum[];
  setAlbums: (v: ImmichAlbum[]) => void;
  fields?: ConfigResponse["fields"];
  onNext: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestImmichResult | null>(null);

  const urlLocked = !!fields?.immich_url.locked;
  const keyLocked = !!fields?.immich_api_key.locked;
  const keyAlreadySet = !!fields?.immich_api_key.set;

  // Can test if we have (a url, set or being entered) and (a key, set or entered).
  const haveUrl = urlLocked || url.trim().length > 0;
  const haveKey = keyLocked || keyAlreadySet || apiKey.trim().length > 0;

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.testImmich({
        url: url.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      });
      setResult(r);
      if (r.albums) setAlbums(r.albums);
    } catch (e) {
      setResult({ ok: false, error: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Immich base URL</Label>
        {urlLocked ? (
          <>
            <div className="field bg-ink-900/60 text-cream-300">
              {fields?.immich_url.value || "set by environment"}
            </div>
            <LockedNote />
          </>
        ) : (
          <input
            className="field"
            type="url"
            placeholder="https://immich.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
      </div>

      <div>
        <Label>
          Immich API key{" "}
          {keyLocked ? null : <SecretStatus set={keyAlreadySet} />}
        </Label>
        {keyLocked ? (
          <>
            <div className="field bg-ink-900/60 text-cream-300">•••• set</div>
            <LockedNote />
          </>
        ) : (
          <input
            className="field"
            type="password"
            autoComplete="off"
            placeholder={keyAlreadySet ? "•••• leave blank to keep" : "API key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        )}
      </div>

      <button
        className="btn-ghost w-full"
        onClick={test}
        disabled={busy || !haveUrl || !haveKey}
      >
        {busy && <Spinner className="h-4 w-4" />}
        Test &amp; load albums
      </button>

      {result && !result.ok && (
        <p className="text-sm text-berry-400">{result.error || "Failed."}</p>
      )}
      {result && result.ok && (
        <p className="text-sm text-sage-400">
          Connected — {albums.length} album{albums.length === 1 ? "" : "s"}{" "}
          found.
        </p>
      )}

      {albums.length > 0 && (
        <div>
          <Label>Album to watch</Label>
          <select
            className="field"
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
          >
            <option value="">Select an album…</option>
            {albums.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name} ({a.assetCount})
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={onNext}
        disabled={!album.trim()}
      >
        Next: Vision
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Vision

function VisionStep({
  presetId,
  onPickPreset,
  baseUrl,
  setBaseUrl,
  apiKey,
  setApiKey,
  model,
  setModel,
  providerLabel,
  local,
  note,
  fields,
  onBack,
  onNext,
}: {
  presetId: string;
  onPickPreset: (id: string) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  providerLabel: string;
  local: boolean;
  note?: string;
  fields?: ConfigResponse["fields"];
  onBack: () => void;
  onNext: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestVisionResult | null>(null);

  const keyLocked = !!fields?.vision_api_key.locked;
  const keyAlreadySet = !!fields?.vision_api_key.set;
  const baseLocked = !!fields?.vision_base_url.locked;
  const modelLocked = !!fields?.vision_model.locked;
  const preset = presetById(presetId);

  const haveModel = modelLocked || model.trim().length > 0;
  const haveKey =
    local || keyLocked || keyAlreadySet || apiKey.trim().length > 0;

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.testVision({
        provider: preset.provider,
        base_url: baseUrl.trim() || undefined,
        api_key: apiKey.trim() || undefined,
        model: model.trim() || undefined,
      });
      setResult(r);
    } catch (e) {
      setResult({ ok: false, error: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider preset</Label>
        <select
          className="field"
          value={presetId}
          onChange={(e) => onPickPreset(e.target.value)}
        >
          {VISION_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {note && <p className="mt-1 text-[11px] text-cream-400/80">{note}</p>}
      </div>

      <div>
        <Label>Base URL</Label>
        {baseLocked ? (
          <>
            <div className="field bg-ink-900/60 text-cream-300">
              {fields?.vision_base_url.value || "set by environment"}
            </div>
            <LockedNote />
          </>
        ) : (
          <input
            className="field"
            type="url"
            placeholder="https://api.openai.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        )}
      </div>

      <div>
        <Label>Model</Label>
        {modelLocked ? (
          <>
            <div className="field bg-ink-900/60 text-cream-300">
              {fields?.vision_model.value || "set by environment"}
            </div>
            <LockedNote />
          </>
        ) : (
          <>
            <input
              className="field"
              placeholder="gpt-4o-mini"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="oja-model-suggestions"
            />
            {preset.models.length > 0 && (
              <datalist id="oja-model-suggestions">
                {preset.models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
          </>
        )}
      </div>

      <div>
        <Label>
          API key{" "}
          {keyLocked || local ? null : <SecretStatus set={keyAlreadySet} />}
        </Label>
        {keyLocked ? (
          <>
            <div className="field bg-ink-900/60 text-cream-300">•••• set</div>
            <LockedNote />
          </>
        ) : (
          <input
            className="field"
            type="password"
            autoComplete="off"
            placeholder={
              local
                ? "Optional for local providers"
                : keyAlreadySet
                  ? "•••• leave blank to keep"
                  : "API key"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        )}
      </div>

      <button
        className="btn-ghost w-full"
        onClick={test}
        disabled={busy || !haveModel || !haveKey}
      >
        {busy && <Spinner className="h-4 w-4" />}
        Test {providerLabel}
      </button>

      {result && !result.ok && (
        <p className="text-sm text-berry-400">{result.error || "Failed."}</p>
      )}
      {result && result.ok && (
        <p className="text-sm text-sage-400">
          Vision OK{result.sample ? ` — “${result.sample}”` : "."}
        </p>
      )}

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary flex-1"
          onClick={onNext}
          disabled={!haveModel || !haveKey}
        >
          Next: Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Save

function SaveStep({
  immichUrl,
  immichKey,
  album,
  presetId,
  providerKind,
  baseUrl,
  visionKey,
  model,
  fields,
  onBack,
  onDone,
}: {
  immichUrl: string;
  immichKey: string;
  album: string;
  presetId: string;
  providerKind: string;
  baseUrl: string;
  visionKey: string;
  model: string;
  fields?: ConfigResponse["fields"];
  onBack: () => void;
  onDone?: () => void;
}) {
  const put = usePutConfig();
  const toast = useToast();

  // Essentials present? Locked fields count as satisfied. Local providers need no key.
  const preset = presetById(presetId);
  const ok =
    (fields?.immich_url.locked || immichUrl.trim().length > 0) &&
    (fields?.immich_api_key.locked ||
      fields?.immich_api_key.set ||
      immichKey.trim().length > 0) &&
    album.trim().length > 0 &&
    (fields?.vision_model.locked || model.trim().length > 0) &&
    (preset.local ||
      fields?.vision_api_key.locked ||
      fields?.vision_api_key.set ||
      visionKey.trim().length > 0);

  function save() {
    // Send only non-locked fields; omit blank secrets so we don't clobber.
    const patch: Record<string, string> = {};
    if (!fields?.immich_url.locked && immichUrl.trim())
      patch.immich_url = immichUrl.trim();
    if (!fields?.immich_api_key.locked && immichKey.trim())
      patch.immich_api_key = immichKey.trim();
    if (!fields?.immich_album.locked && album.trim())
      patch.immich_album = album.trim();
    if (!fields?.vision_provider.locked) patch.vision_provider = presetId;
    if (!fields?.vision_base_url.locked && baseUrl.trim())
      patch.vision_base_url = baseUrl.trim();
    if (!fields?.vision_api_key.locked && visionKey.trim())
      patch.vision_api_key = visionKey.trim();
    if (!fields?.vision_model.locked && model.trim())
      patch.vision_model = model.trim();

    put.mutate(patch, {
      onSuccess: (res) => {
        toast.success("Saved.");
        if (res.configured) onDone?.();
      },
      onError: (e) => toast.error(errText(e)),
    });
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-cream-100">Review</h3>
      <dl className="space-y-2 text-sm">
        <Row label="Immich URL" value={fields?.immich_url.locked ? "🔒 env" : immichUrl || "—"} />
        <Row label="Album" value={album || "—"} />
        <Row label="Provider" value={`${preset.label} (${providerKind})`} />
        <Row label="Base URL" value={fields?.vision_base_url.locked ? "🔒 env" : baseUrl || "—"} />
        <Row label="Model" value={fields?.vision_model.locked ? "🔒 env" : model || "—"} />
      </dl>

      {!ok && (
        <p className="text-xs text-ember-400">
          Fill the essentials (Immich URL + key, album, model + vision key)
          before saving.
        </p>
      )}

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary flex-1"
          onClick={save}
          disabled={!ok || put.isPending}
        >
          {put.isPending && <Spinner className="h-4 w-4" />}
          Save &amp; finish
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-cream-400">{label}</dt>
      <dd className="min-w-0 truncate text-right text-cream-200">{value}</dd>
    </div>
  );
}
