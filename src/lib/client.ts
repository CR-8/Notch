import { log } from './logger';
import { AIClientError } from './providers/errors';

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true,
};

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function isRetryable(err: unknown): boolean {
  if (err instanceof AIClientError) {
    return err.status === 429 || err.status === 503 || err.status === 502 || (err.status ?? 0) >= 500;
  }
  return false;
}

function parseRetryAfter(err: AIClientError): number | null {
  const ms = err.message.match(/retry.?after.?(\d+)/i)?.[1];
  if (ms) return parseInt(ms, 10) * 1000;
  const sec = err.message.match(/retry.?in\s+([0-9.]+)\s*s/i)?.[1];
  if (sec) return Math.ceil(parseFloat(sec) * 1000);
  return null;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err) || attempt === config.maxRetries) {
        throw err;
      }

      let delay = config.baseDelayMs * Math.pow(2, attempt - 1);
      const retryAfter = err instanceof AIClientError ? parseRetryAfter(err) : null;
      if (retryAfter) delay = Math.min(retryAfter, config.maxDelayMs);
      delay = Math.min(delay, config.maxDelayMs);

      if (config.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      log.warn('client', `Retry ${attempt}/${config.maxRetries - 1} in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AIClientError('Request timed out', 'TIMEOUT')), ms)
    ),
  ]);
}
