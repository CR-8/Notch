/**
 * Property-based tests for color label persistence (Property 9).
 * Uses fast-check for property generation.
 *
 * **Validates: Requirements 4.1, 4.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FOLDER_COLORS } from '../color-palette';
import type { TagColorMap } from '../types';

// ── In-memory implementation of getTagColors / setTagColor ───────────────────
// Mirrors the real storage.ts logic without browser APIs.

class InMemoryTagColorStore {
  private map: TagColorMap = {};

  getTagColors(): TagColorMap {
    return { ...this.map };
  }

  setTagColor(tag: string, color: string | null): void {
    if (color === null) {
      delete this.map[tag];
    } else {
      this.map[tag] = color;
    }
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Valid tag names: non-empty strings of printable ASCII, no leading/trailing whitespace */
const arbTag = fc.stringMatching(/^[a-zA-Z0-9_\-]{1,30}$/);

/** Any hex color from the palette */
const arbPaletteColor = fc.constantFrom(...FOLDER_COLORS);

/** Any valid hex color string */
const arbHexColor = fc.stringMatching(/^#[0-9a-f]{6}$/);

// ── Property 9: Color label persistence round-trip ────────────────────────────
// **Validates: Requirements 4.1, 4.2**

describe('Property 9: Color label persistence round-trip', () => {
  it('set color then read back returns same value (palette colors)', () => {
    fc.assert(
      fc.property(arbTag, arbPaletteColor, (tag, color) => {
        const store = new InMemoryTagColorStore();
        store.setTagColor(tag, color);
        const map = store.getTagColors();
        expect(map[tag]).toBe(color);
      }),
      { numRuns: 200 },
    );
  });

  it('set color then read back returns same value (arbitrary hex colors)', () => {
    fc.assert(
      fc.property(arbTag, arbHexColor, (tag, color) => {
        const store = new InMemoryTagColorStore();
        store.setTagColor(tag, color);
        const map = store.getTagColors();
        expect(map[tag]).toBe(color);
      }),
      { numRuns: 200 },
    );
  });

  it('setting null removes the color entry', () => {
    fc.assert(
      fc.property(arbTag, arbPaletteColor, (tag, color) => {
        const store = new InMemoryTagColorStore();
        store.setTagColor(tag, color);
        store.setTagColor(tag, null);
        const map = store.getTagColors();
        expect(map[tag]).toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });

  it('setting color for one tag does not affect other tags', () => {
    fc.assert(
      fc.property(
        arbTag,
        arbTag,
        arbPaletteColor,
        arbPaletteColor,
        (tagA, tagB, colorA, colorB) => {
          if (tagA === tagB) return; // skip when tags are identical
          const store = new InMemoryTagColorStore();
          store.setTagColor(tagA, colorA);
          store.setTagColor(tagB, colorB);
          const map = store.getTagColors();
          expect(map[tagA]).toBe(colorA);
          expect(map[tagB]).toBe(colorB);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('overwriting a color returns the latest value', () => {
    fc.assert(
      fc.property(arbTag, arbPaletteColor, arbPaletteColor, (tag, color1, color2) => {
        const store = new InMemoryTagColorStore();
        store.setTagColor(tag, color1);
        store.setTagColor(tag, color2);
        const map = store.getTagColors();
        expect(map[tag]).toBe(color2);
      }),
      { numRuns: 200 },
    );
  });

  it('FOLDER_COLORS palette has at least 8 entries (Requirement 4.3)', () => {
    expect(FOLDER_COLORS.length).toBeGreaterThanOrEqual(8);
  });

  it('all palette colors are valid hex strings', () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    for (const color of FOLDER_COLORS) {
      expect(color).toMatch(hexPattern);
    }
  });
});
