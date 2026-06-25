import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { memStore } from './helpers.js';
import type { NewEntry, Source } from '../db/types.js';

function entry(over: Partial<NewEntry> & { dish: string; source?: Source }): NewEntry {
  return {
    id: randomUUID(),
    immich_asset_id: randomUUID(),
    taken_at: null,
    day: '2026-01-01',
    logged_at: new Date().toISOString(),
    items: [],
    protein_g: 20,
    carbs_g: 50,
    fat_g: 15,
    confidence: 'low',
    notes: '',
    included: true,
    edited: false,
    source: 'auto',
    raw: null,
    chat: [],
    ...over,
    dish: over.dish,
    kcal: over.kcal ?? 500,
  };
}

describe('food-memory priors (getHistoryPriors)', () => {
  it('puts corrected (edited/manual/chat/reanalyzed) entries first', async () => {
    const store = await memStore();
    await store.insertEntry(entry({ dish: 'Auto Dish', source: 'auto' }));
    await store.insertEntry(entry({ dish: 'Corrected Dish', source: 'manual', edited: true }));
    const priors = await store.getHistoryPriors(30);
    expect(priors[0].dish).toBe('Corrected Dish');
    expect(priors[0].trusted).toBe(true);
    const auto = priors.find((p) => p.dish === 'Auto Dish');
    expect(auto?.trusted).toBe(false);
  });

  it('dedupes by normalized dish (keeps the highest-priority instance)', async () => {
    const store = await memStore();
    // auto first, then a corrected version of the same dish
    await store.insertEntry(entry({ dish: 'Chicken  Rice!', source: 'auto', kcal: 800 }));
    await store.insertEntry(
      entry({ dish: 'chicken rice', source: 'chat', edited: true, kcal: 650 }),
    );
    const priors = await store.getHistoryPriors(30);
    const matches = priors.filter(
      (p) => p.dish.toLowerCase().replace(/[^a-z]/g, '') === 'chickenrice',
    );
    expect(matches).toHaveLength(1);
    // trusted/corrected one wins → its kcal
    expect(matches[0].kcal).toBe(650);
    expect(matches[0].trusted).toBe(true);
  });

  it('respects the limit', async () => {
    const store = await memStore();
    for (let i = 0; i < 10; i++) {
      await store.insertEntry(entry({ dish: `Dish ${i}` }));
    }
    const priors = await store.getHistoryPriors(3);
    expect(priors).toHaveLength(3);
  });

  it('skips empty dishes', async () => {
    const store = await memStore();
    await store.insertEntry(entry({ dish: '' }));
    await store.insertEntry(entry({ dish: 'Real' }));
    const priors = await store.getHistoryPriors(30);
    expect(priors.map((p) => p.dish)).toEqual(['Real']);
  });
});
