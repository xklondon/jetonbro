import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { applySkinTokens, SIMPLE_SKIN, type SkinTokens } from './tokens.js';

const ThemeContext = createContext<SkinTokens>(SIMPLE_SKIN);

export function ThemeProvider({
  tokens = SIMPLE_SKIN,
  children,
}: {
  tokens?: SkinTokens;
  children: ReactNode;
}) {
  useEffect(() => {
    applySkinTokens(document.documentElement, tokens);
  }, [tokens]);
  return <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>;
}

export function useSkin(): SkinTokens {
  return useContext(ThemeContext);
}
