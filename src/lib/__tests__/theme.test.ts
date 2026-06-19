import { describe, it, expect } from 'vitest';
import { resolveTheme, APPEARANCE_STORAGE_KEY } from '../theme';

describe('resolveTheme', () => {
  it('returns the explicit theme as-is', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('resolves system to a concrete theme', () => {
    expect(['light', 'dark']).toContain(resolveTheme('system'));
  });
});

describe('APPEARANCE_STORAGE_KEY', () => {
  it('matches the storage key used by saveAppearance', () => {
    expect(APPEARANCE_STORAGE_KEY).toBe('notch:appearance');
  });
});
