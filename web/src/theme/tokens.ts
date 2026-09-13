export const SKIN_COLOR_KEYS = [
  'background',
  'surface',
  'accent',
  'button',
  'buttonText',
  'text',
  'muted',
  'pot',
  'stack',
] as const;

export type SkinColorKey = (typeof SKIN_COLOR_KEYS)[number];

/** One token object per skin. Casino / Bank / Fun add more entries — not new components. */
export interface SkinTokens {
  id: 'simple' | 'casino' | 'bank' | 'fun';
  name: string;
  icon: string;
  background: string;
  surface: string;
  accent: string;
  button: string;
  buttonText: string;
  text: string;
  muted: string;
  pot: string;
  stack: string;
}

export const SIMPLE_SKIN: SkinTokens = {
  id: 'simple',
  name: 'Simple',
  icon: '◆',
  background: '#f4f1ea',
  surface: '#ffffff',
  accent: '#2f5d50',
  button: '#2f5d50',
  buttonText: '#ffffff',
  text: '#1c1c1c',
  muted: '#6b6b6b',
  pot: '#c45c26',
  stack: '#2f5d50',
};

export const CASINO_SKIN: SkinTokens = {
  id: 'casino',
  name: 'Casino',
  icon: '♠',
  background: '#0d3b2e',
  surface: '#14533f',
  accent: '#d4af37',
  button: '#8b1e3f',
  buttonText: '#fff8e7',
  text: '#f4efe4',
  muted: '#9bb8aa',
  pot: '#d4af37',
  stack: '#c9a227',
};

export const BANK_SKIN: SkinTokens = {
  id: 'bank',
  name: 'Bank',
  icon: '£',
  background: '#1b2430',
  surface: '#243044',
  accent: '#c4a35a',
  button: '#c4a35a',
  buttonText: '#1b2430',
  text: '#e8e4db',
  muted: '#8c93a0',
  pot: '#c4a35a',
  stack: '#7f9bb3',
};

export const FUN_SKIN: SkinTokens = {
  id: 'fun',
  name: 'Fun',
  icon: '★',
  background: '#fff3bf',
  surface: '#ffffff',
  accent: '#5f3dc4',
  button: '#f76707',
  buttonText: '#ffffff',
  text: '#212529',
  muted: '#845ef7',
  pot: '#f03e3e',
  stack: '#37b24d',
};

export const SKINS: Record<SkinTokens['id'], SkinTokens> = {
  simple: SIMPLE_SKIN,
  casino: CASINO_SKIN,
  bank: BANK_SKIN,
  fun: FUN_SKIN,
};

export function applySkinTokens(root: HTMLElement, tokens: SkinTokens): void {
  for (const key of SKIN_COLOR_KEYS) {
    root.style.setProperty(`--skin-${key}`, tokens[key]);
  }
  root.style.setProperty('--skin-icon', `"${tokens.icon}"`);
  root.dataset.skin = tokens.id;
}
