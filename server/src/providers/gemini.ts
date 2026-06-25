import type { VisionAdapter } from './index.js';

/**
 * Google Generative Language API adapter. Sends the image as inlineData and the
 * system prompt as `systemInstruction`. The API key goes in the query string.
 */
export const geminiAdapter: VisionAdapter = async (cfg, image, prompt) => {
  const base = (cfg.base_url ?? 'https://generativelanguage.googleapis.com').replace(
    /\/+$/,
    '',
  );
  // Pass the key in a header, not the URL query string, so it can't leak into
  // access logs if base_url is ever pointed at an unexpected host.
  const url = `${base}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.api_key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt.user },
            {
              inlineData: {
                mimeType: image.contentType || 'image/jpeg',
                data: image.base64,
              },
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vision provider error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');
  if (!content) throw new Error('Vision provider returned empty content');
  return content;
};
