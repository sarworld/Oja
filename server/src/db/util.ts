/** Normalize a dish name for dedupe in the food-memory priors. */
export function normalizeDish(dish: string): string {
  return dish
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Built at runtime so there is never a literal NUL byte in this source file.
const NUL = String.fromCharCode(0);

/**
 * Recursively remove NUL characters (U+0000) from every string in a value.
 * Postgres rejects U+0000 in TEXT and JSONB; SQLite tolerates it. We strip
 * everywhere so writes behave identically across backends. All other characters
 * (emoji, quotes, backslashes, newlines, other unicode) are preserved.
 */
export function stripNul<T>(value: T): T {
  if (typeof value === 'string') {
    return (value.includes(NUL) ? value.split(NUL).join('') : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => stripNul(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripNul(v);
    return out as T;
  }
  return value;
}
