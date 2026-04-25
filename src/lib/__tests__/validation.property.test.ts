/**
 * Property 1: API Key Validation Correctness
 *
 * For any string, each validator returns 'valid' iff the string matches the
 * provider's known pattern, and 'invalid' otherwise.
 *
 * Validates: Requirements 1.2, 1.3, 1.4
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { validateGeminiKey, validateOpenAIKey, validateAnthropicKey } from '../validation';

const GEMINI_SUFFIX = /^[0-9A-Za-z\-_]{35}$/;
const OPENAI_SUFFIX = /^[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_SUFFIX = /^[A-Za-z0-9\-_]{32,}$/;

const GEMINI_FULL = /^AIza[0-9A-Za-z\-_]{35}$/;
const OPENAI_FULL = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_FULL = /^sk-ant-[A-Za-z0-9\-_]{32,}$/;

// --- Valid key arbitraries ---

const validGeminiKeyArb = fc
  .stringMatching(GEMINI_SUFFIX)
  .map(suffix => 'AIza' + suffix);

const validOpenAIKeyArb = fc
  .stringMatching(/^[A-Za-z0-9\-_]{20,50}$/)
  .map(suffix => 'sk-' + suffix);

const validAnthropicKeyArb = fc
  .stringMatching(/^[A-Za-z0-9\-_]{32,50}$/)
  .map(suffix => 'sk-ant-' + suffix);

// --- Tests ---

describe('Property 1: API Key Validation Correctness', () => {
  describe('Gemini', () => {
    it('returns valid for any string matching the Gemini pattern', () => {
      fc.assert(
        fc.property(validGeminiKeyArb, (key) => {
          return validateGeminiKey(key) === 'valid';
        }),
        { numRuns: 100 }
      );
    });

    it('returns invalid for arbitrary strings that do not match the Gemini pattern', () => {
      fc.assert(
        fc.property(fc.string(), (key) => {
          const expected = GEMINI_FULL.test(key) ? 'valid' : 'invalid';
          return validateGeminiKey(key) === expected;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('OpenAI', () => {
    it('returns valid for any string matching the OpenAI pattern', () => {
      fc.assert(
        fc.property(validOpenAIKeyArb, (key) => {
          return validateOpenAIKey(key) === 'valid';
        }),
        { numRuns: 100 }
      );
    });

    it('returns invalid for arbitrary strings that do not match the OpenAI pattern', () => {
      fc.assert(
        fc.property(fc.string(), (key) => {
          const expected = OPENAI_FULL.test(key) ? 'valid' : 'invalid';
          return validateOpenAIKey(key) === expected;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Anthropic', () => {
    it('returns valid for any string matching the Anthropic pattern', () => {
      fc.assert(
        fc.property(validAnthropicKeyArb, (key) => {
          return validateAnthropicKey(key) === 'valid';
        }),
        { numRuns: 100 }
      );
    });

    it('returns invalid for arbitrary strings that do not match the Anthropic pattern', () => {
      fc.assert(
        fc.property(fc.string(), (key) => {
          const expected = ANTHROPIC_FULL.test(key) ? 'valid' : 'invalid';
          return validateAnthropicKey(key) === expected;
        }),
        { numRuns: 100 }
      );
    });
  });
});
