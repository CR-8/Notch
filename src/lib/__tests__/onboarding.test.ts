import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_PROVIDERS,
  getOnboardingProvider,
  cloudSettingsPatch,
  localOnlySettingsPatch,
} from '../onboarding';

describe('ONBOARDING_PROVIDERS', () => {
  it('offers openrouter and anthropic with https key links', () => {
    const ids = ONBOARDING_PROVIDERS.map((p) => p.id);
    expect(ids).toContain('openrouter');
    expect(ids).toContain('anthropic');
    for (const p of ONBOARDING_PROVIDERS) {
      expect(p.keyUrl).toMatch(/^https:\/\//);
    }
  });

  it('uses openai-compatible base URLs that already include the version segment', () => {
    const openrouter = getOnboardingProvider('openrouter')!;
    expect(openrouter.baseUrl).toMatch(/\/v1$/);
  });
});

describe('getOnboardingProvider', () => {
  it('returns undefined for an unknown id', () => {
    expect(getOnboardingProvider('nope')).toBeUndefined();
  });
});

describe('cloudSettingsPatch', () => {
  it('trims the key and disables local-only', () => {
    const p = getOnboardingProvider('anthropic')!;
    const patch = cloudSettingsPatch(p, '  sk-ant-xyz  ');
    expect(patch.apiKey).toBe('sk-ant-xyz');
    expect(patch.provider).toBe('anthropic');
    expect(patch.localOnly).toBe(false);
  });
});

describe('localOnlySettingsPatch', () => {
  it('selects the offline provider and locks local-only', () => {
    const patch = localOnlySettingsPatch();
    expect(patch.provider).toBe('offline');
    expect(patch.localOnly).toBe(true);
    expect(patch.apiKey).toBe('');
  });
});
