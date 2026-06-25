import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { memStore } from './helpers.js';
import type { Store } from '../db/index.js';
import type { NewEntry } from '../db/types.js';

const NUL = String.fromCharCode(0);

// Tricky-but-legal characters that must survive a DB round-trip unchanged.
const NASTY =
  'emoji 🍕🥗👨‍👩‍👧 | quotes " \' ` | backslash \\ slash / | brace {}[] | ' +
  'newline\ntab\t | unicode café Ω 日本語 हिन्दी | ' +
  "sql '; DROP TABLE entries;-- | json {\"a\":1,\"b\":[null]} </script>";

function entry(over: Partial<NewEntry> = {}): NewEntry {
  return {
    id: randomUUID(),
    immich_asset_id: randomUUID(),
    taken_at: null,
    day: '2026-01-01',
    logged_at: new Date().toISOString(),
    dish: 'd',
    items: [{ name: 'rice', kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 1 }],
    kcal: 200,
    protein_g: 4,
    carbs_g: 44,
    fat_g: 1,
    confidence: 'low',
    notes: '',
    included: true,
    edited: false,
    source: 'auto',
    raw: null,
    chat: [],
    ...over,
  };
}

describe('special characters round-trip through the store', () => {
  let store: Store;
  beforeEach(async () => {
    store = await memStore();
  });

  it('preserves emoji, quotes, unicode, newlines and injection-like text', async () => {
    const e = entry({
      dish: NASTY,
      notes: NASTY,
      items: [{ name: NASTY, kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0 }],
    });
    await store.insertEntry(e);
    const updated = await store.updateEntry(e.id, {
      chat: [
        { role: 'user', text: NASTY },
        { role: 'assistant', text: NASTY },
      ],
    });
    expect(updated).not.toBeNull();

    const got = await store.getEntry(e.id);
    expect(got?.dish).toBe(NASTY);
    expect(got?.notes).toBe(NASTY);
    expect(got?.items?.[0]?.name).toBe(NASTY);
    expect(got?.chat?.[0]?.text).toBe(NASTY);
    expect(got?.chat?.[1]?.text).toBe(NASTY);
    // the injection-like text was stored as data, not executed
    expect(await store.getEntry(e.id)).not.toBeNull();
  });

  it('strips NUL bytes (rejected by Postgres) while keeping surrounding text', async () => {
    const e = entry({ dish: `${NUL}lead${NUL}mid${NUL}` });
    await store.insertEntry(e);
    await store.updateEntry(e.id, { chat: [{ role: 'user', text: `hi${NUL}there` }] });

    const got = await store.getEntry(e.id);
    expect(got?.dish).toBe('leadmid');
    expect(got?.dish.includes(NUL)).toBe(false);
    expect(got?.chat?.[0]?.text).toBe('hithere');
  });
});
