import { describe, it, expect } from 'vitest';
import { describeHttpError, AIClientError } from '../providers/errors';

describe('describeHttpError', () => {
  it('detects an HTML 404 as a wrong Base URL rather than dumping markup', () => {
    const msg = describeHttpError('OpenAI-compatible', 404, '<!DOCTYPE html><html><head></head><body>404</body></html>');
    expect(msg).toContain('Base URL');
    expect(msg).not.toContain('<html');
    expect(msg).not.toContain('<!DOCTYPE');
  });

  it('surfaces a JSON error message on 404', () => {
    const msg = describeHttpError('OpenAI-compatible', 404, JSON.stringify({ error: { message: 'model not found' } }));
    expect(msg).toContain('model not found');
  });

  it('maps 401/403 to an auth failure', () => {
    expect(describeHttpError('Anthropic', 401, '')).toMatch(/authentication failed/i);
    expect(describeHttpError('Anthropic', 403, '')).toMatch(/authentication failed/i);
  });

  it('maps 429 to a rate-limit message', () => {
    expect(describeHttpError('Gemini', 429, '')).toMatch(/rate limit|quota/i);
  });

  it('maps 5xx to a server error', () => {
    expect(describeHttpError('Gemini', 503, '')).toMatch(/server error/i);
  });

  it('extracts a string error field', () => {
    const msg = describeHttpError('OpenAI-compatible', 400, JSON.stringify({ error: 'bad request param' }));
    expect(msg).toContain('bad request param');
  });

  it('truncates long unstructured bodies', () => {
    const long = 'x'.repeat(5000);
    const msg = describeHttpError('OpenAI-compatible', 400, long);
    expect(msg.length).toBeLessThan(400);
  });
});

describe('AIClientError', () => {
  it('carries code and status', () => {
    const err = new AIClientError('boom', 'API_ERROR', 429);
    expect(err.code).toBe('API_ERROR');
    expect(err.status).toBe(429);
    expect(err.name).toBe('AIClientError');
  });
});
