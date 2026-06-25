import type { VisionAdapter } from './index.js';

/**
 * OpenAI-compatible chat-completions adapter. Works with OpenAI, OpenRouter,
 * MiniMax, Groq, Together, DeepInfra, Ollama, LM Studio, vLLM — anything that
 * exposes `/chat/completions` accepting an `image_url` content part.
 */
export const openaiAdapter: VisionAdapter = async (cfg, image, prompt) => {
  const base = (cfg.base_url ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.api_key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: prompt.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt.user },
            { type: 'image_url', image_url: { url: image.dataUrl } },
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
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Vision provider returned empty content');
  return content;
};
