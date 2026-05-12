// API key format validators for OpenAI-compatible / Anthropic-compatible providers.

export function validateApiKey(key: string): 'valid' | 'invalid' {
  if (!key || key.length < 10) return 'invalid';
  // Basic format check: should not be obviously malformed
  // Anthropic: sk-ant-...
  // OpenAI: sk-...
  // OpenRouter: supports any format
  if (/^\s+$/.test(key)) return 'invalid';
  return 'valid';
}