/**
 * API key format validators for supported LLM providers.
 * Each validator performs a synchronous regex check and returns 'valid' or 'invalid'.
 */

/**
 * Validates a Gemini API key.
 * Pattern: starts with "AIza", followed by 35 alphanumeric/hyphen/underscore chars (39 total).
 * Requirements: 1.2
 */
export function validateGeminiKey(key: string): 'valid' | 'invalid' {
  return /^AIza[0-9A-Za-z\-_]{35}$/.test(key) ? 'valid' : 'invalid';
}

/**
 * Validates an OpenAI API key.
 * Pattern: starts with "sk-", followed by 20+ alphanumeric/hyphen/underscore chars.
 * Requirements: 1.3
 */
export function validateOpenAIKey(key: string): 'valid' | 'invalid' {
  return /^sk-[A-Za-z0-9\-_]{20,}$/.test(key) ? 'valid' : 'invalid';
}

/**
 * Validates an Anthropic API key.
 * Pattern: starts with "sk-ant-", followed by 32+ alphanumeric/hyphen/underscore chars.
 * Requirements: 1.4
 */
export function validateAnthropicKey(key: string): 'valid' | 'invalid' {
  return /^sk-ant-[A-Za-z0-9\-_]{32,}$/.test(key) ? 'valid' : 'invalid';
}
