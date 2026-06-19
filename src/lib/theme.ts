import type { AppearanceSettings } from './types';

/**
 * Theme application + cross-page sync. Kept free of `wxt/browser` / storage
 * imports (uses the global extension API) so it stays unit-testable and any
 * page can apply + live-sync the theme without duplicated logic.
 */
export type ResolvedTheme = 'light' | 'dark';

export const APPEARANCE_STORAGE_KEY = 'notch:appearance';

export function resolveTheme(theme: AppearanceSettings['theme']): ResolvedTheme {
  if (theme === 'system') {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

/** Apply theme + accent to <html>/<body>. Returns the resolved theme. */
export function applyAppearance(a: AppearanceSettings): ResolvedTheme {
  const resolved = resolveTheme(a.theme);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    if (document.body) document.body.dataset.theme = resolved;
    document.documentElement.style.setProperty('--color-primary', a.accentColor);
  }
  return resolved;
}

/**
 * Subscribe to appearance changes written by any other extension page (the
 * synchronized toggle) and to OS theme changes when in `system` mode.
 * Returns an unsubscribe function.
 */
type ChangeListener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;
interface StorageEventApi {
  storage?: { onChanged?: { addListener(cb: ChangeListener): void; removeListener(cb: ChangeListener): void } };
}

export function watchAppearance(onChange: (a: AppearanceSettings) => void): () => void {
  const ext = globalThis as unknown as { browser?: StorageEventApi; chrome?: StorageEventApi };
  const onChanged = (ext.browser ?? ext.chrome)?.storage?.onChanged;
  if (!onChanged) return () => {};

  const handler: ChangeListener = (changes, area) => {
    if (area !== 'local') return;
    const change = changes[APPEARANCE_STORAGE_KEY];
    if (change?.newValue) onChange(change.newValue as AppearanceSettings);
  };
  onChanged.addListener(handler);
  return () => onChanged.removeListener(handler);
}
