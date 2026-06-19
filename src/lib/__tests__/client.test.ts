import { describe, it, expect, vi } from 'vitest';
import { withRetry, withTimeout } from '../client';
import { AIClientError } from '../providers/errors';

const fastConfig = { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2, jitter: false };

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, fastConfig)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new AIClientError('rate', 'API_ERROR', 429))
      .mockResolvedValue('recovered');
    await expect(withRetry(fn, fastConfig)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new AIClientError('bad', 'API_ERROR', 400));
    await expect(withRetry(fn, fastConfig)).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries', async () => {
    const fn = vi.fn().mockRejectedValue(new AIClientError('down', 'API_ERROR', 503));
    await expect(withRetry(fn, fastConfig)).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('withTimeout', () => {
  it('resolves when the promise beats the timeout', async () => {
    await expect(withTimeout(Promise.resolve('fast'), 1000)).resolves.toBe('fast');
  });

  it('rejects with a timeout error when too slow', async () => {
    const slow = new Promise(resolve => setTimeout(() => resolve('late'), 50));
    await expect(withTimeout(slow, 5)).rejects.toThrow(/timed out/i);
  });
});
