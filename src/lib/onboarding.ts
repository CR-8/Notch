import type { Settings } from './types';

/**
 * Onboarding helpers (Section F). Pure + testable: the list of cloud providers
 * a new user can set up in two taps, deep-links to their key pages, and the
 * settings each choice produces.
 */
export interface OnboardingProvider {
  id: string;
  label: string;
  /** Deep-link to the provider's API-key page (ONB-3). */
  keyUrl: string;
  /** Placeholder hint shown in the paste field. */
  keyHint: string;
  /** Maps to the legacy provider field consumed by the pipeline. */
  provider: 'anthropic' | 'openai-compatible';
  baseUrl: string;
  modelId: string;
}

export const ONBOARDING_PROVIDERS: OnboardingProvider[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-...',
    provider: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'openrouter/free',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-...',
    provider: 'anthropic',
    baseUrl: '',
    modelId: 'claude-sonnet-4-20250514',
  },
];

export function getOnboardingProvider(id: string): OnboardingProvider | undefined {
  return ONBOARDING_PROVIDERS.find((p) => p.id === id);
}

/** Settings patch for a chosen cloud provider + pasted key. */
export function cloudSettingsPatch(p: OnboardingProvider, apiKey: string): Partial<Settings> {
  return {
    apiKey: apiKey.trim(),
    provider: p.provider,
    baseUrl: p.baseUrl,
    modelId: p.modelId,
    defaultMode: 'FAST',
    localOnly: false,
  };
}

/** Settings patch for the private, on-device path (no key). */
export function localOnlySettingsPatch(): Partial<Settings> {
  return {
    provider: 'offline',
    apiKey: '',
    localOnly: true,
    defaultMode: 'FAST',
  };
}
