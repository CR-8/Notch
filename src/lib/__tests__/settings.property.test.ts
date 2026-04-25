/**
 * Property 2: Settings Round-Trip Persistence
 *
 * For any valid Settings object, calling saveSettings() followed by getSettings()
 * SHALL return an object deeply equal to the original, preserving all fields
 * including apiKeys, ollamaEndpoint, defaultMode, and ollamaModel.
 *
 * Validates: Requirements 1.5, 3.6, 12.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { saveSettings, getSettings } from '../storage';
import type { Settings, GenerationMode } from '../types';

// --- Chrome mock ---

const store = new Map<string, unknown>();

global.chrome = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) store.set(k, v);
      }),
      remove: vi.fn(async (key: string) => { store.delete(key); }),
      getBytesInUse: vi.fn(async () => 0),
    },
  },
  runtime: { sendMessage: vi.fn() },
} as unknown as typeof chrome;

// --- Arbitraries ---

const generationModeArb: fc.Arbitrary<GenerationMode> = fc.constantFrom('FAST', 'DEEP', 'LOCAL');

const settingsArb: fc.Arbitrary<Settings> = fc.record({
  apiKeys: fc.record({
    gemini: fc.option(fc.string(), { nil: undefined }),
    openai: fc.option(fc.string(), { nil: undefined }),
    anthropic: fc.option(fc.string(), { nil: undefined }),
  }),
  ollamaEndpoint: fc.oneof(fc.webUrl(), fc.string()),
  defaultMode: generationModeArb,
  ollamaModel: fc.string({ minLength: 1, maxLength: 50 }),
});

// --- Tests ---

describe('Property 2: Settings Round-Trip Persistence', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('saveSettings → getSettings returns a deeply equal Settings for any valid Settings object', async () => {
    await fc.assert(
      fc.asyncProperty(settingsArb, async (settings) => {
        store.clear();
        await saveSettings(settings);
        const retrieved = await getSettings();
        expect(retrieved).toEqual(settings);
      }),
      { numRuns: 100 }
    );
  });
});
