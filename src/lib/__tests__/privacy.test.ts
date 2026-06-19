import { describe, it, expect } from 'vitest';
import { shouldRunOffline, privacyLabel } from '../privacy';

describe('shouldRunOffline', () => {
  it('is true when local-only is locked', () => {
    expect(shouldRunOffline({ provider: 'anthropic', localOnly: true })).toBe(true);
  });

  it('is true for the offline provider', () => {
    expect(shouldRunOffline({ provider: 'offline' })).toBe(true);
  });

  it('is false for a cloud provider with no lock', () => {
    expect(shouldRunOffline({ provider: 'anthropic' })).toBe(false);
  });
});

describe('privacyLabel', () => {
  it('reports on-device when locked', () => {
    expect(privacyLabel({ localOnly: true })).toMatch(/on-device/i);
  });

  it('names the provider when sending to cloud', () => {
    expect(privacyLabel({ provider: 'anthropic' }, 'Anthropic')).toBe('Sent to Anthropic');
  });
});
