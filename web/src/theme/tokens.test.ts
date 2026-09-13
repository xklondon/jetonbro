/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { applySkinTokens, SIMPLE_SKIN, SKIN_COLOR_KEYS, SKINS, type SkinTokens } from './tokens.js';

function extraSkin(id: SkinTokens['id'], name: string, icon: string): SkinTokens {
  return {
    ...SIMPLE_SKIN,
    id,
    name,
    icon,
    background: '#111',
    accent: '#c00',
    button: '#c00',
    pot: '#fc0',
    stack: '#0c0',
  };
}

describe('skin token structure', () => {
  it('lets Casino, Bank, and Fun register as token objects without new component keys', () => {
    const extras: SkinTokens[] = [
      extraSkin('casino', 'Casino', '♠'),
      extraSkin('bank', 'Bank', '£'),
      extraSkin('fun', 'Fun', '★'),
    ];
    for (const skin of extras) {
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
    expect(Object.keys(SKINS)).toEqual(['simple', 'casino', 'bank', 'fun']);
    expect(SKINS.simple).toEqual(SIMPLE_SKIN);
    expect(SKINS.casino).toBeUndefined();
    expect(SKINS.bank).toBeUndefined();
    expect(SKINS.fun).toBeUndefined();
  });
});
