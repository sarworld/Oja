import type { Entry } from '../db/types.js';

export interface DayTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: number;
}

/** Sum included entries for a day. */
export function computeTotals(entries: Entry[]): DayTotals {
  const totals: DayTotals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, meals: 0 };
  for (const e of entries) {
    if (!e.included) continue;
    totals.kcal += e.kcal;
    totals.protein_g += e.protein_g;
    totals.carbs_g += e.carbs_g;
    totals.fat_g += e.fat_g;
    totals.meals += 1;
  }
  // Round macros to 1 decimal to avoid float noise.
  totals.protein_g = Math.round(totals.protein_g * 10) / 10;
  totals.carbs_g = Math.round(totals.carbs_g * 10) / 10;
  totals.fat_g = Math.round(totals.fat_g * 10) / 10;
  totals.kcal = Math.round(totals.kcal);
  return totals;
}
