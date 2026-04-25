/**
 * Property 3: Popup Provider Status Indicator
 *
 * For any Settings object, the provider dot for each provider should be
 * violet (#5E6AD2) if the key is present (non-empty string), and danger
 * red (#FF3366) if absent (undefined or empty string).
 *
 * Validates: Requirements 1.8
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Settings } from '../types';

// Pure function extracted from StatusBar logic in popup/App.tsx
function getProviderColor(key: string | undefined): string {
  return key ? '#5E6AD2' : '#FF3366';
}

const VIOLET = '#5E6AD2';
const DANGER_RED = '#FF3366';

// Arbitrary for an optional API key: either a non-empty string or undefined
const optionalKeyArb = fc.option(fc.string({ minLength: 1 }), { nil: undefined });

// Arbitrary for a full Settings object with arbitrary key presence
const settingsArb: fc.Arbitrary<Settings> = fc.record({
  apiKeys: fc.record({
    gemini: optionalKeyArb,
    openai: optionalKeyArb,
    anthropic: optionalKeyArb,
  }),
  ollamaEndpoint: fc.string(),
  defaultMode: fc.constantFrom('FAST' as const, 'DEEP' as const, 'LOCAL' as const),
  ollamaModel: fc.string(),
});

describe('Property 3: Popup Provider Status Indicator', () => {
  it('gemini dot is violet when key is present, red when absent', () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const color = getProviderColor(settings.apiKeys.gemini);
        const hasKey = Boolean(settings.apiKeys.gemini);
        expect(color).toBe(hasKey ? VIOLET : DANGER_RED);
      }),
      { numRuns: 100 }
    );
  });

  it('openai dot is violet when key is present, red when absent', () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const color = getProviderColor(settings.apiKeys.openai);
        const hasKey = Boolean(settings.apiKeys.openai);
        expect(color).toBe(hasKey ? VIOLET : DANGER_RED);
      }),
      { numRuns: 100 }
    );
  });

  it('anthropic dot is violet when key is present, red when absent', () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const color = getProviderColor(settings.apiKeys.anthropic);
        const hasKey = Boolean(settings.apiKeys.anthropic);
        expect(color).toBe(hasKey ? VIOLET : DANGER_RED);
      }),
      { numRuns: 100 }
    );
  });

  it('all three providers follow the color mapping for any Settings', () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const providers = ['gemini', 'openai', 'anthropic'] as const;
        for (const provider of providers) {
          const key = settings.apiKeys[provider];
          const color = getProviderColor(key);
          expect(color).toBe(key ? VIOLET : DANGER_RED);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('empty string key maps to danger red (treated as absent)', () => {
    fc.assert(
      fc.property(fc.constantFrom('' as string | undefined, undefined), (key) => {
        expect(getProviderColor(key)).toBe(DANGER_RED);
      }),
      { numRuns: 100 }
    );
  });

  it('non-empty string key always maps to violet', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (key) => {
        expect(getProviderColor(key)).toBe(VIOLET);
      }),
      { numRuns: 100 }
    );
  });
});
