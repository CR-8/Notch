import { describe, it, expect } from 'vitest';
import { parseModelsResponse } from '../models-api';

describe('parseModelsResponse', () => {
  it('returns [] for malformed payloads', () => {
    expect(parseModelsResponse(null)).toEqual([]);
    expect(parseModelsResponse({})).toEqual([]);
    expect(parseModelsResponse({ data: 'nope' })).toEqual([]);
  });

  it('maps id, name and context length', () => {
    const out = parseModelsResponse({
      data: [{ id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 128000 }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'openai/gpt-4o', name: 'GPT-4o', contextLength: 128000 });
  });

  it('falls back to id when name is missing', () => {
    const [m] = parseModelsResponse({ data: [{ id: 'x/y' }] });
    expect(m.name).toBe('x/y');
  });

  it('flags free models from zero pricing and sorts them first', () => {
    const out = parseModelsResponse({
      data: [
        { id: 'paid/model', pricing: { prompt: '0.001', completion: '0.002' } },
        { id: 'free/model', pricing: { prompt: '0', completion: '0' } },
      ],
    });
    expect(out[0].id).toBe('free/model');
    expect(out[0].free).toBe(true);
    expect(out[1].free).toBe(false);
  });

  it('drops entries without a string id', () => {
    const out = parseModelsResponse({ data: [{ name: 'no id' }, { id: '' }, { id: 'ok/model' }] });
    expect(out.map(m => m.id)).toEqual(['ok/model']);
  });
});
