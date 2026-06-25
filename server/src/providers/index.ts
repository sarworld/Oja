import type { Confidence, Item } from '../db/types.js';

/** Parsed, normalized vision estimate (provider-agnostic). */
export interface VisionResult {
  is_food: boolean;
  dish: string;
  items: Item[];
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  confidence: Confidence;
  notes: string;
  reply?: string;
  raw: unknown;
}

/** Config a provider adapter needs to make a call. */
export interface ProviderConfig {
  base_url?: string;
  api_key: string;
  model: string;
}

/** An image as raw bytes + content type, or a ready data: URL. */
export interface VisionImage {
  dataUrl: string;
  contentType: string;
  base64: string;
}

/**
 * A vision adapter: given provider config, an image, and a fully-formed prompt,
 * return the raw text content of the model's reply (parsing happens centrally).
 */
export type VisionAdapter = (
  cfg: ProviderConfig,
  image: VisionImage,
  prompt: { system: string; user: string },
) => Promise<string>;

/** ---- shared text post-processing ---------------------------------------- */

/** Remove <think>…</think> reasoning blocks some models emit. */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/** Extract the first balanced {…} JSON object from a string. */
export function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function n(v: unknown, fallback = 0): number {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? x : fallback;
}

function coerceConfidence(v: unknown): Confidence {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'low';
}

/** Parse raw model text → normalized VisionResult (with total fallback). */
export function parseVisionResult(content: string): VisionResult {
  const cleaned = stripThink(content);
  const jsonStr = extractJson(cleaned);
  if (!jsonStr) {
    throw new Error('Vision response contained no JSON object');
  }
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`Vision JSON parse failed: ${(e as Error).message}`);
  }

  const items: Item[] = Array.isArray(obj.items)
    ? (obj.items as Array<Record<string, unknown>>).map((it) => ({
        name: String(it.name ?? '').trim() || 'item',
        kcal: Math.round(n(it.kcal)),
        protein_g: n(it.protein_g),
        carbs_g: n(it.carbs_g),
        fat_g: n(it.fat_g),
      }))
    : [];

  const sum = (k: keyof Item) =>
    items.reduce((acc, it) => acc + (it[k] as number), 0);

  const total_kcal =
    obj.total_kcal != null ? Math.round(n(obj.total_kcal)) : Math.round(sum('kcal'));
  const total_protein_g =
    obj.total_protein_g != null ? n(obj.total_protein_g) : sum('protein_g');
  const total_carbs_g =
    obj.total_carbs_g != null ? n(obj.total_carbs_g) : sum('carbs_g');
  const total_fat_g = obj.total_fat_g != null ? n(obj.total_fat_g) : sum('fat_g');

  return {
    is_food: obj.is_food !== false,
    dish: String(obj.dish ?? '').trim(),
    items,
    total_kcal,
    total_protein_g,
    total_carbs_g,
    total_fat_g,
    confidence: coerceConfidence(obj.confidence),
    notes: String(obj.notes ?? '').trim(),
    reply: obj.reply != null ? String(obj.reply).trim() : undefined,
    raw: obj,
  };
}

/** ---- adapter registry --------------------------------------------------- */

import { openaiAdapter } from './openai.js';
import { anthropicAdapter } from './anthropic.js';
import { geminiAdapter } from './gemini.js';

const ADAPTERS: Record<string, VisionAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
};

/** Select an adapter by provider id, defaulting to OpenAI-compatible. */
export function getAdapter(provider: string | undefined): VisionAdapter {
  return ADAPTERS[(provider ?? 'openai').toLowerCase()] ?? openaiAdapter;
}

/** ---- presets for the setup UI ------------------------------------------- */

export interface Preset {
  label: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  base_url: string;
  models: string[];
  note?: string;
}

export const PRESETS: Preset[] = [
  {
    label: 'OpenAI',
    provider: 'openai',
    base_url: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  },
  {
    label: 'OpenRouter',
    provider: 'openai',
    base_url: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
      'anthropic/claude-3.5-sonnet',
      'qwen/qwen2.5-vl-72b-instruct',
    ],
    note: 'Aggregator — use any model in provider/model form.',
  },
  {
    label: 'MiniMax',
    provider: 'openai',
    base_url: 'https://api.minimax.io/v1',
    models: ['MiniMax-VL-01'],
  },
  {
    label: 'Groq',
    provider: 'openai',
    base_url: 'https://api.groq.com/openai/v1',
    models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'],
  },
  {
    label: 'Together AI',
    provider: 'openai',
    base_url: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-4-Scout-17B-16E-Instruct', 'Qwen/Qwen2.5-VL-72B-Instruct'],
  },
  {
    label: 'DeepInfra',
    provider: 'openai',
    base_url: 'https://api.deepinfra.com/v1/openai',
    models: ['meta-llama/Llama-3.2-90B-Vision-Instruct', 'Qwen/Qwen2.5-VL-7B-Instruct'],
  },
  {
    label: 'Ollama (local)',
    provider: 'openai',
    base_url: 'http://localhost:11434/v1',
    models: ['llava', 'llama3.2-vision', 'qwen2.5vl'],
    note: 'Local — API key can be any non-empty string (e.g. "ollama").',
  },
  {
    label: 'LM Studio (local)',
    provider: 'openai',
    base_url: 'http://localhost:1234/v1',
    models: ['local-model'],
    note: 'Local — API key can be any non-empty string (e.g. "lm-studio").',
  },
  {
    label: 'Anthropic',
    provider: 'anthropic',
    base_url: 'https://api.anthropic.com',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-7-sonnet-latest'],
  },
  {
    label: 'Google Gemini',
    provider: 'gemini',
    base_url: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  },
  {
    label: 'Custom',
    provider: 'openai',
    base_url: '',
    models: [],
    note: 'Any OpenAI-compatible endpoint (vLLM, LiteLLM, etc.).',
  },
];
