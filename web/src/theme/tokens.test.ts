/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  applySkinTokens,
  BANK_SKIN,
  CASINO_SKIN,
  FUN_SKIN,
  SIMPLE_SKIN,
  SKIN_COLOR_KEYS,
  SKINS,
} from './tokens.js';

describe('skin token structure', () => {
  it('registers Casino, Bank, and Fun as token objects on the same keys', () => {
    expect(Object.keys(SKINS)).toEqual(['simple', 'casino', 'bank', 'fun']);
    expect(SKINS.simple).toEqual(SIMPLE_SKIN);
    expect(SKINS.casino).toEqual(CASINO_SKIN);
    expect(SKINS.bank).toEqual(BANK_SKIN);
    expect(SKINS.fun).toEqual(FUN_SKIN);
    for (const skin of [CASINO_SKIN, BANK_SKIN, FUN_SKIN]) {
      expect(skin.id).not.toBe('simple');
      for (const key of SKIN_COLOR_KEYS) {
        expect(typeof skin[key]).toBe('string');
        expect(skin[key].length).toBeGreaterThan(0);
      }
      expect(skin.icon).toBeTruthy();
      const root = document.createElement('div');
      applySkinTokens(root, skin);
      expect(root.dataset.skin).toBe(skin.id);
      expect(root.style.getPropertyValue('--skin-background')).toBe(skin.background);
      expect(root.style.getPropertyValue('--skin-button')).toBe(skin.button);
      expect(root.style.getPropertyValue('--skin-pot')).toBe(skin.pot);
    }
  });
});
