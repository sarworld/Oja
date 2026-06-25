/** Local-day helpers. We work in the browser's local timezone for navigation;
 * the backend assigns the canonical `day` per its TZ. */

export function todayStr(): string {
  return toDayStr(new Date());
}

export function toDayStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDayStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(s: string, delta: number): string {
  const d = parseDayStr(s);
  d.setDate(d.getDate() + delta);
  return toDayStr(d);
}

export function isToday(s: string): boolean {
  return s === todayStr();
}

/** "Today", "Yesterday", or "Mon, Jun 24" */
export function prettyDay(s: string): string {
  if (s === todayStr()) return "Today";
  if (s === addDays(todayStr(), -1)) return "Yesterday";
  const d = parseDayStr(s);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Short label for chart axis: "6/24" */
export function shortDay(s: string): string {
  const d = parseDayStr(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
