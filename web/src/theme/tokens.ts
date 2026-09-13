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

export const SKINS: Record<SkinTokens['id'], SkinTokens | undefined> = {
  simple: SIMPLE_SKIN,
  casino: undefined,
  bank: undefined,
  fun: undefined,
};

export function applySkinTokens(root: HTMLElement, tokens: SkinTokens): void {
  for (const key of SKIN_COLOR_KEYS) {
    root.style.setProperty(`--skin-${key}`, tokens[key]);
  }
  root.style.setProperty('--skin-icon', `"${tokens.icon}"`);
  root.dataset.skin = tokens.id;
}
