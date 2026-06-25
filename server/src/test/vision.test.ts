import { describe, it, expect } from 'vitest';
import { stripThink, extractJson, parseVisionResult } from '../providers/index.js';

describe('stripThink', () => {
  it('removes <think> blocks (case-insensitive, multiline)', () => {
    const t = 'before<think>secret\nreasoning</think>after';
    expect(stripThink(t)).toBe('beforeafter');
    expect(stripThink('<THINK>x</THINK>{"a":1}')).toBe('{"a":1}');
  });

  it('leaves plain text untouched', () => {
    expect(stripThink('hello')).toBe('hello');
  });
});

describe('extractJson', () => {
  it('extracts the first balanced object', () => {
    expect(extractJson('noise {"a":1} trailing')).toBe('{"a":1}');
  });

  it('handles nested objects and braces in strings', () => {
    const s = 'x {"a":{"b":2},"s":"a }{ b"} y';
    expect(extractJson(s)).toBe('{"a":{"b":2},"s":"a }{ b"}');
  });

  it('returns null when no object present', () => {
    expect(extractJson('no json here')).toBeNull();
  });
});

describe('parseVisionResult', () => {
  it('parses a clean JSON object and strips think blocks first', () => {
    const content =
      '<think>let me think</think>{"is_food":true,"dish":"Rice bowl",' +
      '"items":[{"name":"rice","kcal":200,"protein_g":4,"carbs_g":44,"fat_g":0.5}],' +
      '"total_kcal":200,"total_protein_g":4,"total_carbs_g":44,"total_fat_g":0.5,' +
      '"confidence":"high","notes":"looks good"}';
    const r = parseVisionResult(content);
    expect(r.is_food).toBe(true);
    expect(r.dish).toBe('Rice bowl');
    expect(r.items).toHaveLength(1);
    expect(r.total_kcal).toBe(200);
    expect(r.confidence).toBe('high');
  });

  it('falls back to summed item totals when totals are missing', () => {
    const content =
      '{"is_food":true,"dish":"Plate","items":[' +
      '{"name":"a","kcal":100,"protein_g":5,"carbs_g":10,"fat_g":2},' +
      '{"name":"b","kcal":50,"protein_g":3,"carbs_g":4,"fat_g":1}]}';
    const r = parseVisionResult(content);
    expect(r.total_kcal).toBe(150);
    expect(r.total_protein_g).toBe(8);
    expect(r.total_carbs_g).toBe(14);
    expect(r.total_fat_g).toBe(3);
  });

  it('coerces invalid confidence to low and trims dish', () => {
    const r = parseVisionResult('{"dish":"  Soup  ","confidence":"weird"}');
    expect(r.confidence).toBe('low');
    expect(r.dish).toBe('Soup');
  });

  it('marks non-food correctly', () => {
    const r = parseVisionResult('{"is_food":false,"dish":"cat","notes":"not food"}');
    expect(r.is_food).toBe(false);
  });

  it('handles markdown fences / prose around the JSON', () => {
    const content = 'Here you go:\n```json\n{"dish":"Toast","total_kcal":120}\n```\nthanks';
    const r = parseVisionResult(content);
    expect(r.dish).toBe('Toast');
    expect(r.total_kcal).toBe(120);
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseVisionResult('sorry, I cannot')).toThrow(/no JSON/i);
  });

  it('rounds item + total kcal to whole numbers', () => {
    const r = parseVisionResult(
      '{"items":[{"name":"x","kcal":99.6,"protein_g":1,"carbs_g":1,"fat_g":1}],"total_kcal":99.6}',
    );
    expect(r.items[0].kcal).toBe(100);
    expect(r.total_kcal).toBe(100);
  });
});
