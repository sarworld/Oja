import { useState } from "react";
import { useAuth } from "./lib/auth";
import { useHealth } from "./lib/queries";
import { Login } from "./views/Login";
import { Today } from "./views/Today";
import { History } from "./views/History";
import { Settings } from "./views/Settings";
import { Setup } from "./views/Setup";
import { LoadingView } from "./components/StateViews";

type Tab = "today" | "history" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "🍽️" },
  { id: "history", label: "History", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export default function App() {
  const { authed } = useAuth();
  const health = useHealth();
  const [tab, setTab] = useState<Tab>("today");

  if (!authed) return <Login />;

  // Gate on configuration: until Immich + vision are set up, route to /setup.
  if (health.isLoading) return <LoadingView label="Loading…" />;
  if (health.data && !health.data.configured) {
    return <Setup onDone={() => health.refetch()} />;
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-700 bg-ink-900/85 px-4 py-3 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="text-xl">🍲</span>
        <h1 className="text-lg font-semibold tracking-tight">Oja</h1>
        <span className="ml-auto text-xs font-medium uppercase tracking-wide text-cream-400">
          {TABS.find((t) => t.id === tab)?.label}
        </span>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">
        {tab === "today" && <Today />}
        {tab === "history" && <History />}
        {tab === "settings" && <Settings />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700 bg-ink-900/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors " +
                  (active ? "text-ember-400" : "text-cream-400 hover:text-cream-200")
                }
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
