# Vision providers

Oja calls **your** vision LLM to read each food photo. You bring the model and the key,
which means **you control cost and privacy**. Oja supports most models through three
adapters, selected by `VISION_PROVIDER` (`vision_provider` in the UI):

- **`openai`** — any **OpenAI-compatible** `/chat/completions` endpoint that accepts
  `image_url` input. This single value covers the large majority of providers below (and
  any other OpenAI-compatible gateway, including self-hosted vLLM, LiteLLM, etc.).
- **`anthropic`** — Claude's **native** Messages API (image content blocks).
- **`gemini`** — Google's **native** Generative Language API (`inlineData`).

The setup wizard ships these as **presets** that auto-fill the base URL and suggest
vision-capable models. Pick whichever you have a key for — and note that **Ollama** and
**LM Studio** give you a fully **local, `$0`, private** option where your photos and keys
never leave your machine.

## At a glance

| Provider | `provider` | `base_url` | Example vision model | Notes |
|---|---|---|---|---|
| **OpenAI** | `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` | Good, cheap default. |
| **OpenRouter** | `openai` | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | One key, gateway to Anthropic / Gemini / Llama / etc. Prefix the model with its vendor. |
| **MiniMax** | `openai` | `https://api.minimax.io/v1` | `MiniMax-VL-01` | |
| **Groq** | `openai` | `https://api.groq.com/openai/v1` | `meta-llama/llama-4-scout-17b-16e-instruct` | Fast hosted inference. |
| **Together** | `openai` | `https://api.together.xyz/v1` | `meta-llama/Llama-4-Scout-17B-16E-Instruct` | |
| **DeepInfra** | `openai` | `https://api.deepinfra.com/v1/openai` | `meta-llama/Llama-3.2-90B-Vision-Instruct` | |
| **Ollama** (local) | `openai` | `http://localhost:11434/v1` | `llava` | **Local, free, private.** From Docker use `host.docker.internal`. Any non-empty key. |
| **LM Studio** (local) | `openai` | `http://localhost:1234/v1` | `llava-v1.6` | **Local, free, private.** Start its local server. Any non-empty key. |
| **Anthropic** (native) | `anthropic` | `https://api.anthropic.com` | `claude-3-5-sonnet-latest` | Native Messages API. |
| **Google Gemini** (native) | `gemini` | `https://generativelanguage.googleapis.com` | `gemini-2.0-flash` | Native Generative Language API. |
| **Custom** | `openai` | *your endpoint* | *your model* | Any other OpenAI-compatible `/chat/completions` endpoint. |

::: tip Model ids change over time
Provider model ids and base URLs move. The examples above are starting points — check your
provider's current docs for the latest **vision-capable** model. The setup wizard's preset
dropdown also suggests a few current options per provider.
:::

## How to pick one

- **Want it cheap and easy?** Start with **OpenAI `gpt-4o-mini`** — solid quality at roughly
  a fraction of a cent per photo.
- **Want one key for many models?** Use **OpenRouter** and point the model at
  `anthropic/…`, `google/…`, `openai/…`, `qwen/…`, etc.
- **Want zero cloud and `$0`?** Run **Ollama** (or **LM Studio**) locally. Your photos and
  keys never leave your machine. Trade-off: local models are generally **less accurate**
  than the best hosted ones.
- **Already pay for Anthropic or Gemini?** Use the **native** `anthropic` / `gemini`
  adapters with your existing key.

A practical rule: **hosted = more accurate, costs cents; local = free + fully private,
somewhat less accurate.** Oja's [personal food memory](/usage#personal-food-memory) closes
much of the gap over time by learning *your* numbers — so even a modest local model gets
better for your recurring meals.

## Cost & privacy notes

- **Cost.** With bring-your-own-key, *you* pay your provider directly (no Oja
  subscription). Cheap hosted vision models cost a fraction of a cent per photo; local
  models cost nothing but your hardware/electricity.
- **Privacy.** With a **local** model (Ollama/LM Studio), nothing leaves your network. With
  a **cloud** model, only the **photo + prompt** are sent to your provider per analysis —
  your diary, history, and goals always stay in your own database. Choose accordingly.

## Per-provider examples

The wizard sets the same fields these `.env` blocks do.

### OpenAI

A good, cheap default.

```ini
VISION_PROVIDER=openai
VISION_BASE_URL=https://api.openai.com/v1
VISION_MODEL=gpt-4o-mini
VISION_API_KEY=sk-...
```

### OpenRouter

One key, gateway to Anthropic / Gemini / Llama and many more. Prefix the model with its
vendor.

```ini
VISION_PROVIDER=openai
VISION_BASE_URL=https://openrouter.ai/api/v1
VISION_MODEL=openai/gpt-4o-mini
VISION_API_KEY=sk-or-...
```

### MiniMax

```ini
VISION_PROVIDER=openai
VISION_BASE_URL=https://api.minimax.io/v1
VISION_MODEL=MiniMax-VL-01
VISION_API_KEY=...
```

### Groq

Fast hosted inference.

```ini
VISION_PROVIDER=openai
VISION_BASE_URL=https://api.groq.com/openai/v1
VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
VISION_API_KEY=gsk_...
```

### Together

```ini
VISION_PROVIDER=openai
VISION_BASE_URL=https://api.together.xyz/v1
VISION_MODEL=meta-llama/Llama-4-Scout-17B-16E-Instruct
VISION_API_KEY=...
```

### DeepInfra

```ini
VISION_PROVIDER=openai
VISION_BASE_URL=https://api.deepinfra.com/v1/openai
VISION_MODEL=meta-llama/Llama-3.2-90B-Vision-Instruct
VISION_API_KEY=...
```

### Ollama (local, `$0`, private)

Fully local, no cloud. Ollama exposes an OpenAI-compatible API at `/v1`.

```ini
VISION_PROVIDER=openai
# From inside Docker, use host.docker.internal (see note below). On bare metal,
# http://localhost:11434/v1 is the default.
VISION_BASE_URL=http://host.docker.internal:11434/v1
VISION_MODEL=llava
VISION_API_KEY=ollama
```

Pull a vision model first:

```bash
ollama pull llava
```

The API key can be **any non-empty string** (e.g. `ollama`). Other vision-capable Ollama
models include `llama3.2-vision` and `minicpm-v`.

### LM Studio (local, `$0`, private)

Start LM Studio's local server, then:

```ini
VISION_PROVIDER=openai
VISION_BASE_URL=http://host.docker.internal:1234/v1
VISION_MODEL=llava-v1.6
VISION_API_KEY=lm-studio
```

Load a vision-capable model in LM Studio; the key can be any non-empty string.

### Anthropic (native)

Uses the native Messages API, so the base URL is the Anthropic endpoint.

```ini
VISION_PROVIDER=anthropic
VISION_BASE_URL=https://api.anthropic.com
VISION_MODEL=claude-3-5-sonnet-latest
VISION_API_KEY=sk-ant-...
```

### Google Gemini (native)

Uses the native Generative Language API.

```ini
VISION_PROVIDER=gemini
VISION_BASE_URL=https://generativelanguage.googleapis.com
VISION_MODEL=gemini-2.0-flash
VISION_API_KEY=...
```

### Custom (any OpenAI-compatible endpoint)

Self-hosted vLLM, LiteLLM, or any gateway exposing `/chat/completions` with `image_url`
input.

```ini
VISION_PROVIDER=openai
VISION_BASE_URL=https://your-endpoint.example.com/v1
VISION_MODEL=your-vision-model
VISION_API_KEY=your-key
```

## Reaching a local model from Docker

Inside a container, `localhost` is the **container's** loopback, not your host. To reach a
model running on the host, use **`host.docker.internal`** in the base URL (e.g.
`http://host.docker.internal:11434/v1`). On **Linux**, add the gateway mapping to the
service:

```yaml
services:
  oja:
    # ...
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Or point the base URL at your host's **LAN IP** instead. See
[Installation → Calling a local model from inside Docker](/installation#calling-a-local-model-from-inside-docker).

## What Oja asks the model for

For each photo, Oja sends a prompt that asks the model to identify the dish and each
visible item and estimate calories + macros **for the portion shown**, returning a single
JSON object. Oja then strips any `<think>…</think>` reasoning, extracts the JSON, and falls
back to summing the per-item numbers if the model omits totals — so minor formatting quirks
don't break a sync. Details: [How sync works](/how-sync-works#the-vision-step) and
[Architecture](/architecture#the-vision-contract).
