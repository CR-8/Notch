import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export type ReaderTheme = 'dark' | 'light';

export interface ReaderThemeContextValue {
  theme: ReaderTheme;
  setTheme: Dispatch<SetStateAction<ReaderTheme>>;
  toggleTheme: () => void;
}

export const ReaderThemeContext = createContext<ReaderThemeContextValue | null>(null);

export function useReaderTheme(): ReaderThemeContextValue {
  const context = useContext(ReaderThemeContext);
  if (!context) {
    throw new Error('useReaderTheme must be used inside ReaderThemeContext.Provider');
  }
  return context;
}
