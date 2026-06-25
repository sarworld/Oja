/**
 * Compute the local YYYY-MM-DD "day" for an instant, honoring the configured TZ.
 * Uses Intl so it works regardless of the host clock.
 */
export function localDay(iso: string | null | undefined, tz: string): string {
  const d = iso ? new Date(iso) : new Date();
  const valid = !Number.isNaN(d.getTime()) ? d : new Date();
  // en-CA gives YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(valid);
}

export function todayLocal(tz: string): string {
  return localDay(new Date().toISOString(), tz);
}
