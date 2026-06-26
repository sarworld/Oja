# Vision providers

Oja doesn't ship an AI service — you point it at any **vision-capable** model.
Most providers speak the OpenAI-compatible API, so `VISION_PROVIDER=openai` covers
the majority; there are also native `anthropic` and `gemini` adapters.

The setup wizard has presets for all of these. To set them by hand:

| Provider | `VISION_PROVIDER` | `VISION_BASE_URL` | Example model |
|---|---|---|---|
| **Ollama** (local) | `openai` | `http://localhost:11434/v1` | `llava`, `qwen2.5vl` |
| **LM Studio** (local) | `openai` | `http://localhost:1234/v1` | (loaded model) |
| OpenAI | `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `openai` | `https://openrouter.ai/api/v1` | `qwen/qwen2.5-vl-72b-instruct` |
| Groq | `openai` | `https://api.groq.com/openai/v1` | a Llama-4 vision model |
| Together / DeepInfra | `openai` | their `…/v1` URL | a Qwen-VL / Llama-Vision model |
| Anthropic | `anthropic` | `https://api.anthropic.com` | a Claude model |
| Google Gemini | `gemini` | `https://generativelanguage.googleapis.com` | `gemini-2.0-flash` |

For local models, any non-empty `VISION_API_KEY` works (e.g. `ollama`).

## Running Oja in Docker with a model on the host

`localhost` inside the container is the container itself. To reach Ollama / LM
Studio running on the host, use **`host.docker.internal`**:

```bash
VISION_BASE_URL=http://host.docker.internal:11434/v1
```

On Linux, add the gateway mapping to your `docker-compose.yml`:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## Picking a model

Bigger vision models estimate better but cost more / run slower. A small local
model (llava, qwen2.5-vl) keeps everything on your server for free; a hosted model
trades some privacy for accuracy. Try a few — you can re-analyze any meal after
switching.
