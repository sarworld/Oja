import type { VisionAdapter } from './index.js';

/**
 * Anthropic native Messages API adapter. Uses base64 image content blocks.
 * The system prompt is passed as the top-level `system` field.
 */
export const anthropicAdapter: VisionAdapter = async (cfg, image, prompt) => {
  const base = (cfg.base_url ?? 'https://api.anthropic.com').replace(/\/+$/, '');
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.api_key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1200,
      // No temperature/top_p: current Claude models (Opus 4.8/4.7, Fable 5)
      // reject sampling parameters with a 400. Omitting them works on every
      // Claude model (Haiku 4.5, Sonnet 4.6, Opus, Fable).
      system: prompt.system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt.user },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.contentType || 'image/jpeg',
                data: image.base64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vision provider error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  if (!content) throw new Error('Vision provider returned empty content');
  return content;
};
