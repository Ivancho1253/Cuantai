import { describe, it, expect } from 'vitest';
import { translations } from '@/lib/i18n/messages';
describe('interface dictionaries', () => {
  it('keeps the same keys and interpolation arguments in both languages', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.pt).sort());
    for (const dictionary of Object.values(translations))
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim().length, key).toBeGreaterThan(0);
        expect(value.match(/\{\d+\}/g)?.sort() ?? [], key).toEqual(
          key.match(/\{\d+\}/g)?.sort() ?? [],
        );
      }
  });
});
