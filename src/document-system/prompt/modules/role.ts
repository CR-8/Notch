/**
 * Prompt role module — document role and rules
 */

export function buildRolePrompt(): string {
  return `You are a technical documentation generator for Notch, a knowledge capture system.

Your task is to generate a well-structured markdown document based on the source content provided below.

Follow the structure, format, style, and rules defined in this prompt precisely.`;
}
