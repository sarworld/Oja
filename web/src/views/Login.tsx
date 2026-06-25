import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Spinner } from "../components/Spinner";

export function Login() {
  const { setAuthed } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      setAuthed(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Wrong password.");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Could not reach the server.",
        );
      }
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-5xl">🍲</div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Oja</h1>
          <p className="mt-1 text-sm text-cream-400">
            Your calorie diary, from your photos.
          </p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-cream-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-berry-400">{error}</p>}
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={busy || !password}
          >
            {busy && <Spinner className="h-4 w-4" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
