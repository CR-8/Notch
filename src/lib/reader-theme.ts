import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Dispatch, SetStateAction, ReactNode } from 'react';
import { getAppearance } from './storage';

export type ReaderTheme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface ReaderThemeContextValue {
  theme: ReaderTheme;
  resolvedTheme: ResolvedTheme;
  setTheme: Dispatch<SetStateAction<ReaderTheme>>;
  toggleTheme: () => void;
  fontFamily: 'mono' | 'serif' | 'sans';
  fontSize: 'sm' | 'md' | 'lg';
  accentColor: string;
}

export const ReaderThemeContext = createContext<ReaderThemeContextValue | null>(null);

export function useReaderTheme(): ReaderThemeContextValue {
  const context = useContext(ReaderThemeContext);
  if (!context) {
    throw new Error('useReaderTheme must be used inside ReaderThemeContext.Provider');
  }
  return context;
}

const STORAGE_KEY = 'notch:reader-theme';

function getInitialTheme(): ReaderTheme {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  return 'dark';
}

function resolveTheme(theme: ReaderTheme): ResolvedTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return theme;
}

export function ReaderThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ReaderTheme>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));
  const [fontFamily, setFontFamily] = useState<'mono' | 'serif' | 'sans'>('mono');
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [accentColor, setAccentColor] = useState('#e07c3a');

  useEffect(() => {
    getAppearance().then((a) => {
      setTheme(a.theme);
      setResolvedTheme(resolveTheme(a.theme));
      setFontFamily(a.fontFamily);
      setFontSize(a.fontSize);
      setAccentColor(a.accentColor);
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      if (theme === 'system') {
        setResolvedTheme(resolveTheme(theme));
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    setResolvedTheme(resolveTheme(theme));
    window.localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.dataset.theme = resolveTheme(theme);
    document.body.dataset.theme = resolveTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', accentColor);
  }, [accentColor]);

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : t === 'light' ? 'system' : 'dark');
  };

  const contextValue = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    fontFamily,
    fontSize,
    accentColor,
  };

  return React.createElement(
    ReaderThemeContext.Provider,
    { value: contextValue },
    children,
  );
}