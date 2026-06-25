import type { HistoryPrior } from './db/types.js';
import type { EffectiveConfig } from './config-service.js';
import {
  getAdapter,
  parseVisionResult,
  type VisionImage,
  type VisionResult,
} from './providers/index.js';

export type { VisionResult } from './providers/index.js';
export { stripThink, extractJson, parseVisionResult } from './providers/index.js';

const BASE_PROMPT = `You are a careful nutrition estimator. You are shown a photo of food.
Identify the dish and each visible item, and estimate calories and macros for the PORTION SHOWN
(not generic per-100g values). Be realistic; prefer the user's own past numbers when a dish matches.

Return ONLY a single JSON object, no prose, no markdown fences:
{"is_food":true,"dish":"…","items":[{"name":"…","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}],
 "total_kcal":0,"total_protein_g":0,"total_carbs_g":0,"total_fat_g":0,
 "confidence":"low|medium|high","notes":"…","reply":"short friendly sentence (chat/reanalyze only)"}

Rules:
- If the image is not food, return {"is_food":false, ...} with zeros and a short note.
- "items" totals should roughly sum to the total_* fields.
- Numbers are for the visible portion. Round to whole kcal, one decimal for macros is fine.
- "confidence" reflects how sure you are about the portion and identity.`;

function priorsBlock(priors: HistoryPrior[]): string {
  if (!priors.length) return '';
  const lines = priors
    .map((p) => {
      const mark = p.trusted ? '✓' : ' ';
      return `${mark} ${p.dish}: ${Math.round(p.kcal)} kcal, P${p.protein_g} C${p.carbs_g} F${p.fat_g}`;
    })
    .join('\n');
  return `\n\nPERSONAL FOOD MEMORY (the user's past meals). If this photo resembles one of these,
use its numbers. ✓ marks trusted, user-corrected values — prefer those strongly.\n${lines}`;
}

export interface AnalyzeOptions {
  /** Extra user instruction (reanalyze corrected description, or chat message). */
  userText?: string;
  /** Whether to ask for a `reply` (chat / reanalyze flows). */
  wantReply?: boolean;
  /** Prior chat turns to include for context. */
  chatHistory?: Array<{ role: string; text: string }>;
}

/** Parse a data: URL into the pieces every adapter may need. */
export function imageFromDataUrl(dataUrl: string): VisionImage {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) {
    return { dataUrl, contentType: 'image/jpeg', base64: '' };
  }
  return { dataUrl, contentType: m[1], base64: m[2] };
}

/**
 * Run a vision estimate using the *effective* config (read at call time, so UI
 * changes take effect without a restart). Selects the adapter by provider.
 */
export async function analyze(
  cfg: EffectiveConfig,
  imageDataUrl: string,
  priors: HistoryPrior[],
  opts: AnalyzeOptions = {},
): Promise<VisionResult> {
  if (!cfg.vision_api_key || !cfg.vision_model) {
    throw new Error('Vision is not configured');
  }

  let systemPrompt = BASE_PROMPT + priorsBlock(priors);
  if (opts.wantReply) {
    systemPrompt +=
      '\n\nAlso include a short, friendly "reply" sentence acknowledging the user.';
  }

  const textParts: string[] = [];
  if (opts.chatHistory?.length) {
    textParts.push(
      'Conversation so far:\n' +
        opts.chatHistory.map((m) => `${m.role}: ${m.text}`).join('\n'),
    );
  }
  if (opts.userText) {
    textParts.push(`User correction / message: ${opts.userText}`);
  }
  textParts.push('Analyze this meal and return the JSON object.');

  const adapter = getAdapter(cfg.vision_provider);
  const content = await adapter(
    {
      base_url: cfg.vision_base_url,
      api_key: cfg.vision_api_key,
      model: cfg.vision_model,
    },
    imageFromDataUrl(imageDataUrl),
    { system: systemPrompt, user: textParts.join('\n\n') },
  );
  return parseVisionResult(content);
}

/**
 * Tiny round-trip used by the "test vision" endpoint. Sends a 1x1 pixel and
 * asks for a fixed JSON token, returning a short sample on success.
 */
export async function testVision(cfg: {
  provider?: string;
  base_url?: string;
  api_key: string;
  model: string;
}): Promise<{ ok: boolean; error?: string; sample?: string }> {
  // A small opaque 16x16 JPEG. (A 1x1 transparent PNG is rejected by some
  // providers — e.g. Anthropic returns "Could not process image".)
  const jpeg =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBKKKKAP//Z';
  const dataUrl = `data:image/jpeg;base64,${jpeg}`;
  try {
    const adapter = getAdapter(cfg.provider);
    const content = await adapter(
      { base_url: cfg.base_url, api_key: cfg.api_key, model: cfg.model },
      imageFromDataUrl(dataUrl),
      {
        system: 'Reply with a single short JSON object like {"ok":true}. No prose.',
        user: 'Respond with {"ok":true}.',
      },
    );
    // Strip any chain-of-thought and collapse whitespace so the UI shows a
    // clean confirmation rather than raw <think> reasoning.
    const clean = content
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return { ok: true, sample: clean.slice(0, 120) || "model responded" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
