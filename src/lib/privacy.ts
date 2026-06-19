/**
 * PRIV-3 / PRIV-1 — privacy posture helpers. When local-only is locked on, the
 * pipeline must never make a network call; when off, the UI must tell the user
 * exactly where their data goes. Pure and testable.
 */
export interface PrivacyState {
  provider?: string;
  localOnly?: boolean;
}

/** True when work must stay on-device (explicit lock, or the offline provider). */
export function shouldRunOffline(s: PrivacyState): boolean {
  return s.localOnly === true || s.provider === 'offline';
}

/** Human-readable data-flow indicator for the UI. */
export function privacyLabel(s: PrivacyState, providerLabel?: string): string {
  if (shouldRunOffline(s)) return 'On-device · private';
  return providerLabel ? `Sent to ${providerLabel}` : 'Cloud';
}
