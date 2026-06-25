// Vision provider presets for the setup wizard.
//
// Mirrors SPEC's PRESETS list. Selecting a preset auto-fills the OpenAI-compatible
// base URL plus a model suggestion. `provider` maps to the backend adapter
// (`openai` covers everything OpenAI-compatible; `anthropic`/`gemini` are native).
// `local` providers usually need no API key.

export type ProviderKind = "openai" | "anthropic" | "gemini";

export interface VisionPreset {
  /** Stable id, also used as `vision_provider` when sent to the backend. */
  id: string;
  label: string;
  /** Backend adapter to use. */
  provider: ProviderKind;
  base_url: string;
  models: string[];
  /** When true, base_url/model are user-supplied (don't lock the fields). */
  custom?: boolean;
  /** Local provider — typically no API key required. */
  local?: boolean;
  note?: string;
}

export const VISION_PRESETS: VisionPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    provider: "openai",
    base_url: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    provider: "openai",
    base_url: "https://openrouter.ai/api/v1",
    models: [
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash-001",
    ],
    note: "One key, many models — prefix the model with its vendor.",
  },
  {
    id: "minimax",
    label: "MiniMax",
    provider: "openai",
    base_url: "https://api.minimax.io/v1",
    models: ["MiniMax-VL-01", "abab6.5s-chat"],
  },
  {
    id: "groq",
    label: "Groq",
    provider: "openai",
    base_url: "https://api.groq.com/openai/v1",
    models: [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama-3.2-90b-vision-preview",
    ],
  },
  {
    id: "together",
    label: "Together",
    provider: "openai",
    base_url: "https://api.together.xyz/v1",
    models: [
      "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      "Qwen/Qwen2-VL-72B-Instruct",
    ],
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    provider: "openai",
    base_url: "https://api.deepinfra.com/v1/openai",
    models: [
      "meta-llama/Llama-3.2-90B-Vision-Instruct",
      "Qwen/Qwen2-VL-72B-Instruct",
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    provider: "openai",
    base_url: "http://localhost:11434/v1",
    models: ["llava", "llama3.2-vision", "minicpm-v"],
    local: true,
    note: "Local — usually no API key needed.",
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    provider: "openai",
    base_url: "http://localhost:1234/v1",
    models: ["llava-v1.6", "qwen2-vl-7b-instruct"],
    local: true,
    note: "Local — usually no API key needed.",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    provider: "anthropic",
    base_url: "https://api.anthropic.com",
    models: ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8"],
    note: "Native Messages API. Haiku is cheapest; all support vision.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    provider: "gemini",
    base_url: "https://generativelanguage.googleapis.com",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    note: "Native Generative Language API.",
  },
  {
    id: "custom",
    label: "Custom",
    provider: "openai",
    base_url: "",
    models: [],
    custom: true,
    note: "Any OpenAI-compatible /chat/completions endpoint.",
  },
];

/** Find a preset by id, falling back to Custom. */
export function presetById(id: string | undefined): VisionPreset {
  return (
    VISION_PRESETS.find((p) => p.id === id) ??
    VISION_PRESETS[VISION_PRESETS.length - 1]
  );
}

/** Normalize a base URL for comparison (lowercase, no trailing slash). */
function normBase(u: string | undefined): string {
  return (u ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Human-friendly provider name for display. Prefers a base-URL match so an
 * OpenAI-compatible endpoint shows its real service (e.g. "MiniMax") rather than
 * the underlying "openai" adapter; falls back to the preset whose id equals the
 * stored provider, then to a generic label.
 */
export function providerLabel(
  provider: string | undefined,
  baseUrl?: string,
): string {
  const base = normBase(baseUrl);
  if (base) {
    const byBase = VISION_PRESETS.find(
      (p) => !p.custom && normBase(p.base_url) === base,
    );
    if (byBase) return byBase.label;
  }
  const byId = VISION_PRESETS.find((p) => p.id === provider && !p.custom);
  if (byId) return byId.label;
  if (base) return "Custom (OpenAI-compatible)";
  return provider ?? "—";
}
