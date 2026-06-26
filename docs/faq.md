# FAQ & troubleshooting

### How accurate are the numbers?
They're estimates from a vision model reading a single photo — ballpark figures,
sometimes off by a lot (portion size and hidden ingredients are hard). Oja is for
casual tracking, **not nutrition or medical advice**. You can correct any meal by
chatting with it, and your corrections become priors that improve future guesses.

### Does it modify my Immich library?
No. Oja only **reads** the album through the Immich API. It never edits, moves, or
deletes anything.

### How does sync work?
Oja polls the album every `POLL_INTERVAL_MINUTES` (default 90; `0` disables
auto-sync). New images are analyzed once and remembered; there's also a **Sync
now** button. Days and totals use your `TZ`.

### Can it run fully offline?
Yes — point it at a local Ollama or LM Studio model and nothing leaves your
server. There's no telemetry either way.

### What image formats?
Whatever your vision model accepts (typically JPEG/PNG/WebP). Oja proxies the
Immich thumbnail/preview; the original is never sent to the browser.

---

## Troubleshooting

**Can't connect to Immich.** Check the URL is reachable *from the Oja container*
and the API key is valid. From inside Docker, `localhost` is the container — use
the host's LAN IP or `host.docker.internal`.

**Vision errors / "no JSON object".** The model returned something unparseable.
Reasoning models need enough output room — make sure your provider allows a few
thousand output tokens. Try a different/bigger vision model, or re-analyze.

**Logged out / login won't stick behind a proxy.** Over HTTPS, set
`COOKIE_SECURE=true` so the session cookie is accepted.

**Permission denied on the data dir.** The container runs non-root (uid 1000). If
you bind-mount a host path instead of the named volume, `chown 1000:1000` it.

Still stuck? Open an issue on [GitHub](https://github.com/sarworld/Oja/issues).
