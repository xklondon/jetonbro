import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applySkinTokens, SIMPLE_SKIN, SKINS, type SkinTokens } from './tokens.js';

const SKIN_KEY = 'jetonbro.skin';
const CHIPS_KEY = 'jetonbro.chipVisual';

export interface Appearance {
  tokens: SkinTokens;
  skinId: SkinTokens['id'];
  setSkinId: (id: SkinTokens['id']) => void;
  chipVisual: boolean;
  setChipVisual: (on: boolean) => void;
}

const ThemeContext = createContext<Appearance>({
  tokens: SIMPLE_SKIN,
  skinId: 'simple',
  setSkinId: () => undefined,
  chipVisual: false,
  setChipVisual: () => undefined,
});

function readSkinId(): SkinTokens['id'] {
  const stored = localStorage.getItem(SKIN_KEY);
  if (stored && stored in SKINS) {
    return stored as SkinTokens['id'];
  }
  return 'simple';
}

export function ThemeProvider({
  tokens,
  children,
}: {
  tokens?: SkinTokens;
  children: ReactNode;
}) {
  const [skinId, setSkinIdState] = useState<SkinTokens['id']>(readSkinId);
  const [chipVisual, setChipVisualState] = useState(() => localStorage.getItem(CHIPS_KEY) === '1');
  const resolved = tokens ?? SKINS[skinId] ?? SIMPLE_SKIN;

  useEffect(() => {
    applySkinTokens(document.documentElement, resolved);
  }, [resolved]);

  const value = useMemo<Appearance>(
    () => ({
      tokens: resolved,
      skinId: resolved.id,
      setSkinId: (id) => {
        localStorage.setItem(SKIN_KEY, id);
        setSkinIdState(id);
      },
      chipVisual,
      setChipVisual: (on) => {
        localStorage.setItem(CHIPS_KEY, on ? '1' : '0');
        setChipVisualState(on);
      },
    }),
    [resolved, chipVisual],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useSkin(): SkinTokens {
  return useContext(ThemeContext).tokens;
}

export function useAppearance(): Appearance {
  return useContext(ThemeContext);
}
