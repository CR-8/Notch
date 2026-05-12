/**
 * Strict input sanitization and security utilities for Notch.
 *
 * Addresses:
 * - XSS via unsanitized HTML in marked.parse() output
 * - XSS via javascript:/data: URLs in markdown links
 * - Attribute injection via incomplete HTML escaping (missing quote escaping)
 * - Code language injection via unsanitized language identifiers
 * - Control character injection in user input / AI responses
 * - Schema validation for imported bundles (crafted PDF protection)
 * - Structural fence integrity for markdown documents
 */

import type { Citation } from './types';

// ── Complete HTML Entity Escaping ────────────────────────────────────────────

/**
 * Full HTML entity escaping including single and double quotes.
 * Fixes the incomplete escapeHtml() in markdown-parser.ts which
 * did not escape quotes, allowing attribute injection in contexts
 * like `<pre data-fallback="true">${text}</pre>`.
 */
export function escapeHtmlFull(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── HTML Sanitization ────────────────────────────────────────────────────────

/**
 * Strip dangerous HTML elements and attributes from a string.
 * Used to sanitize AI-generated markdown before it's converted to HTML
 * and rendered via marked.
 *
 * Removes:
 * - <script>, <iframe>, <object>, <embed>, <applet>, <form> tags (with content)
 * - Event handler attributes (onclick, onerror, etc.)
 * - javascript:, data:, vbscript: URL schemes in href/src attributes
 */
export function sanitizeHtml(html: string): string {
  return html
    // Remove <script> tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove other dangerous tags with content
    .replace(/<(iframe|object|embed|applet|form|input|textarea|select|button|link|style|meta|base)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Remove self-closing / void dangerous tags
    .replace(/<(iframe|object|embed|applet|form|input|textarea|select|button|link|style|meta|base)\b[^>]*\/?>/gi, '')
    // Remove event handler attributes (onclick="...", onerror='...', onload=...)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Block dangerous URL schemes in href
    .replace(/(\bhref\s*=\s*)(["']?)\s*(javascript|data|vbscript)\s*:/gi, '$1$2about:blank#blocked-')
    // Block dangerous URL schemes in src
    .replace(/(\bsrc\s*=\s*)(["']?)\s*(javascript|data|vbscript)\s*:/gi, '$1$2about:blank#blocked-');
}

// ── URL Scheme Validation ────────────────────────────────────────────────────

const SAFE_URL_SCHEMES = new Set([
  'http', 'https', 'mailto', 'tel', 'ftp', 'ftps',
]);

/**
 * Validate a URL scheme. Returns the URL if safe, or a blocked placeholder
 * if the scheme is dangerous (javascript:, data:, vbscript:, etc.).
 * Relative URLs and fragment-only URLs are allowed through.
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*)\s*:/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (!SAFE_URL_SCHEMES.has(scheme)) {
      return 'about:blank#blocked-';
    }
  }
  return trimmed;
}

// ── Code Language Sanitization ───────────────────────────────────────────────

const ALLOWED_LANGUAGES = new Set([
  // Common languages
  'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'ruby', 'rb',
  'java', 'c', 'cpp', 'c++', 'csharp', 'c#', 'go', 'golang', 'rust',
  'swift', 'kotlin', 'scala', 'r', 'sql', 'shell', 'bash', 'sh', 'zsh',
  'powershell', 'ps1', 'cmd', 'bat',
  // Web
  'html', 'css', 'scss', 'sass', 'less', 'xml', 'yaml', 'yml', 'json',
  'toml', 'ini', 'env',
  // Markup / docs
  'markdown', 'md', 'latex', 'tex', 'asciidoc', 'adoc',
  // Diagrams (Notch-specific)
  'mermaid', 'plantuml',
  // Other common
  'dockerfile', 'makefile', 'graphql', 'proto', 'protobuf',
  'lua', 'perl', 'php', 'dart', 'elixir', 'erlang', 'haskell',
  'clojure', 'lisp', 'scheme', 'fsharp', 'ocaml',
  // Data formats
  'csv', 'tsv', 'diff', 'patch', 'log',
  // Generic
  'text', 'plaintext', 'code', 'source',
]);

/**
 * Sanitize a code block language identifier.
 * Returns the language if it's in the whitelist or matches a safe pattern,
 * or empty string if it looks dangerous.
 * Prevents injection of arbitrary strings into code block attributes.
 */
export function sanitizeCodeLanguage(lang: string): string {
  const normalized = lang.trim().toLowerCase();
  if (!normalized) return '';
  if (ALLOWED_LANGUAGES.has(normalized)) return normalized;
  // Allow well-formed identifiers (letters, digits, +, -, .) up to 30 chars
  if (/^[a-z][a-z0-9+\-.]{0,29}$/.test(normalized)) return normalized;
  return '';
}

// ── User Input Sanitization ──────────────────────────────────────────────────

const MAX_USER_INPUT_LENGTH = 10_000;
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitize user input text (chat queries, etc.).
 * - Strips control characters (except \t \n \r)
 * - Trims whitespace
 * - Enforces maximum length
 */
export function sanitizeUserInput(input: string, maxLength: number = MAX_USER_INPUT_LENGTH): string {
  const stripped = input.replace(CONTROL_CHARS_REGEX, '');
  const trimmed = stripped.trim();
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

// ── AI Response Sanitization ─────────────────────────────────────────────────

/**
 * Sanitize AI-generated text before storage and display.
 * - Removes null bytes and control characters
 * - Validates and sanitizes markdown link/image URLs
 */
export function sanitizeAiResponse(text: string): string {
  let sanitized = text
    .replace(/\x00/g, '')
    .replace(CONTROL_CHARS_REGEX, '');

  // Sanitize markdown link URLs: [text](url)
  sanitized = sanitized.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, linkText: string, url: string) => {
      const safeUrl = sanitizeUrl(url);
      return `[${linkText}](${safeUrl})`;
    },
  );

  // Sanitize markdown image URLs: ![alt](url)
  sanitized = sanitized.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, altText: string, url: string) => {
      const safeUrl = sanitizeUrl(url);
      return `![${altText}](${safeUrl})`;
    },
  );

  return sanitized;
}

// ── Import Bundle Validation ─────────────────────────────────────────────────

const VALID_MODES = new Set(['FAST', 'DEEP', 'BALANCED', 'LOCAL']);
const VALID_PROVIDERS = new Set(['gemini', 'ollama', 'offline', 'openai', 'anthropic']);

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/**
 * Validate and sanitize an imported document bundle from a PDF attachment.
 * Returns the validated bundle or throws on structural invalidity.
 * Prevents crafted PDFs from injecting malformed data into the document store.
 */
export function validateImportBundle(raw: unknown): {
  document: Record<string, unknown>;
  chunks: Record<string, unknown>[];
  embeddings: Array<{ id: string; vector: number[] }>;
} {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid import bundle: expected an object');
  }

  const bundle = raw as Record<string, unknown>;

  // ── Validate document ────────────────────────────────────────────────────
  const doc = bundle.document;
  if (!doc || typeof doc !== 'object') {
    throw new Error('Invalid import bundle: missing document');
  }

  const d = doc as Record<string, unknown>;

  // Required string fields
  if (!isString(d.id) || d.id.length === 0 || d.id.length > 256) {
    throw new Error('Invalid import bundle: document.id must be a non-empty string (max 256 chars)');
  }
  if (!isString(d.title) || d.title.length > 10_000) {
    throw new Error('Invalid import bundle: document.title must be a string (max 10000 chars)');
  }
  if (!isString(d.url) || d.url.length > 10_000) {
    throw new Error('Invalid import bundle: document.url must be a string (max 10000 chars)');
  }
  if (!isString(d.domain) || d.domain.length > 1000) {
    throw new Error('Invalid import bundle: document.domain must be a string (max 1000 chars)');
  }
  if (!isString(d.capturedAt)) {
    throw new Error('Invalid import bundle: document.capturedAt must be a string');
  }

  // Numeric fields
  if (!isNumber(d.wordCount) || d.wordCount < 0) {
    throw new Error('Invalid import bundle: document.wordCount must be a non-negative number');
  }

  // Enum fields
  if (!isString(d.mode) || !VALID_MODES.has(d.mode)) {
    throw new Error('Invalid import bundle: document.mode must be one of: FAST, DEEP, BALANCED, LOCAL');
  }
  if (!isString(d.provider) || !VALID_PROVIDERS.has(d.provider)) {
    throw new Error('Invalid import bundle: document.provider must be one of: gemini, ollama, offline, openai, anthropic');
  }

  // Content
  if (!isString(d.content)) {
    throw new Error('Invalid import bundle: document.content must be a string');
  }

  // Boolean fields
  if (d.isStarred !== undefined && !isBoolean(d.isStarred)) {
    throw new Error('Invalid import bundle: document.isStarred must be a boolean');
  }
  if (d.isArchived !== undefined && !isBoolean(d.isArchived)) {
    throw new Error('Invalid import bundle: document.isArchived must be a boolean');
  }
  if (d.isRead !== undefined && !isBoolean(d.isRead)) {
    throw new Error('Invalid import bundle: document.isRead must be a boolean');
  }
  if (d.embeddingsGenerated !== undefined && !isBoolean(d.embeddingsGenerated)) {
    throw new Error('Invalid import bundle: document.embeddingsGenerated must be a boolean');
  }

  // Array fields
  if (d.tags !== undefined && !isArray(d.tags)) {
    throw new Error('Invalid import bundle: document.tags must be an array');
  }
  if (d.keyEntities !== undefined && !isArray(d.keyEntities)) {
    throw new Error('Invalid import bundle: document.keyEntities must be an array');
  }
  if (d.timeline !== undefined && !isArray(d.timeline)) {
    throw new Error('Invalid import bundle: document.timeline must be an array');
  }
  if (d.concepts !== undefined && !isArray(d.concepts)) {
    throw new Error('Invalid import bundle: document.concepts must be an array');
  }
  if (d.images !== undefined && !isArray(d.images)) {
    throw new Error('Invalid import bundle: document.images must be an array');
  }
  if (d.missingImageQueries !== undefined && !isArray(d.missingImageQueries)) {
    throw new Error('Invalid import bundle: document.missingImageQueries must be an array');
  }

  // ── Validate chunks ──────────────────────────────────────────────────────
  const chunks = bundle.chunks;
  if (!isArray(chunks)) {
    throw new Error('Invalid import bundle: chunks must be an array');
  }

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i] as Record<string, unknown>;
    if (!c || typeof c !== 'object') {
      throw new Error(`Invalid import bundle: chunks[${i}] must be an object`);
    }
    if (!isString(c.id)) {
      throw new Error(`Invalid import bundle: chunks[${i}].id must be a string`);
    }
    if (!isString(c.documentId)) {
      throw new Error(`Invalid import bundle: chunks[${i}].documentId must be a string`);
    }
    if (!isNumber(c.chunkIndex) || c.chunkIndex < 0) {
      throw new Error(`Invalid import bundle: chunks[${i}].chunkIndex must be a non-negative number`);
    }
    if (!isString(c.text)) {
      throw new Error(`Invalid import bundle: chunks[${i}].text must be a string`);
    }
    if (!isNumber(c.paragraphIndex) || c.paragraphIndex < 0) {
      throw new Error(`Invalid import bundle: chunks[${i}].paragraphIndex must be a non-negative number`);
    }
  }

  // ── Validate embeddings ──────────────────────────────────────────────────
  const embeddings = bundle.embeddings;
  if (!isArray(embeddings)) {
    throw new Error('Invalid import bundle: embeddings must be an array');
  }

  for (let i = 0; i < embeddings.length; i++) {
    const e = embeddings[i] as Record<string, unknown>;
    if (!e || typeof e !== 'object') {
      throw new Error(`Invalid import bundle: embeddings[${i}] must be an object`);
    }
    if (!isString(e.id)) {
      throw new Error(`Invalid import bundle: embeddings[${i}].id must be a string`);
    }
    if (!isArray(e.vector)) {
      throw new Error(`Invalid import bundle: embeddings[${i}].vector must be an array`);
    }
    const vec = e.vector as unknown[];
    if (vec.length > 10_000) {
      throw new Error(`Invalid import bundle: embeddings[${i}].vector exceeds maximum length (10000)`);
    }
    for (let j = 0; j < vec.length; j++) {
      if (!isNumber(vec[j])) {
        throw new Error(`Invalid import bundle: embeddings[${i}].vector[${j}] must be a finite number`);
      }
    }
  }

  return bundle as {
    document: Record<string, unknown>;
    chunks: Record<string, unknown>[];
    embeddings: Array<{ id: string; vector: number[] }>;
  };
}

// ── Structural Fence Validation ──────────────────────────────────────────────

/**
 * Validate that markdown content has properly balanced code fences.
 * Handles both backtick (```) and tilde (~~~) fences.
 * Returns the validation result with repaired content (unclosed fences auto-closed).
 */
export function validateStructuralFences(md: string): {
  valid: boolean;
  repaired: string;
  unclosedFences: number;
} {
  const lines = md.split('\n');
  let inCodeBlock = false;
  let fenceChar = '';
  let fenceLength = 0;
  let unclosedFences = 0;
  const repairedLines: string[] = [];

  for (const line of lines) {
    const fenceMatch = line.match(/^([`~]{3,})([\w+-]*)\s*$/);

    if (fenceMatch && !inCodeBlock) {
      // Opening fence
      inCodeBlock = true;
      fenceChar = fenceMatch[1][0];
      fenceLength = fenceMatch[1].length;
      const lang = sanitizeCodeLanguage(fenceMatch[2]);
      repairedLines.push(`${fenceChar.repeat(fenceLength)}${lang}`);
    } else if (
      fenceMatch &&
      inCodeBlock &&
      fenceMatch[1][0] === fenceChar &&
      fenceMatch[1].length >= fenceLength
    ) {
      // Closing fence (must match or exceed opening fence length)
      inCodeBlock = false;
      repairedLines.push(fenceChar.repeat(fenceLength));
    } else {
      repairedLines.push(line);
    }
  }

  // Auto-close any unclosed fences
  if (inCodeBlock) {
    unclosedFences = 1;
    repairedLines.push(fenceChar.repeat(fenceLength));
  }

  return {
    valid: unclosedFences === 0,
    repaired: repairedLines.join('\n'),
    unclosedFences,
  };
}

// ── Reassembly Buffer ────────────────────────────────────────────────────────

/**
 * ReassemblyBuffer accumulates streamed text chunks and provides
 * the continuously growing reassembled document text.
 * Used by the ChatPanel to stitch sequential streamed chunks
 * into a cohesive, continuously rendered long document.
 */
export class ReassemblyBuffer {
  private chunks: string[] = [];
  private _isComplete = false;
  private _citations: Citation[] = [];

  get isComplete(): boolean {
    return this._isComplete;
  }

  get citations(): Citation[] {
    return this._citations;
  }

  /** Current reassembled text (all chunks joined) */
  get text(): string {
    return this.chunks.join('');
  }

  /** Number of chunks received so far */
  get chunkCount(): number {
    return this.chunks.length;
  }

  /** Append a new chunk to the buffer */
  append(chunk: string): void {
    if (this._isComplete) return;
    this.chunks.push(chunk);
  }

  /** Mark the stream as complete with final citations */
  complete(citations: Citation[] = []): void {
    this._isComplete = true;
    this._citations = citations;
  }

  /** Reset the buffer for a new stream */
  reset(): void {
    this.chunks = [];
    this._isComplete = false;
    this._citations = [];
  }
}

// ── Markdown Formatter ─────────────────────────────────────────────────────────

/**
 * Normalize and format markdown content for consistent output.
 * Ensures proper spacing, heading styles, list formatting, and code blocks.
 */
export function formatMarkdown(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let prevWasHeading = false;
  let prevWasCode = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines at start
    if (result.length === 0 && trimmed === '') continue;

    // Handle headings - ensure ATX style and spacing
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (prevWasHeading) result.push(''); // Blank line before same-level heading
      result.push(trimmed);
      prevWasHeading = true;
      prevWasCode = false;
      inList = false;
      continue;
    }
    prevWasHeading = false;

    // Handle code fences
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (!prevWasCode && result.length > 0) result.push(''); // Blank line before code
      result.push(trimmed);
      prevWasCode = !trimmed.startsWith('```') || !trimmed.includes('```', 3)
        ? trimmed.startsWith('```') && !trimmed.includes('```', 3)
        : !trimmed.endsWith('```');
      // Actually prevWasCode should track if we're IN a code block
      const isOpen = !trimmed.startsWith('```') || !trimmed.includes('```', 3)
        ? trimmed.startsWith('~~~') && !trimmed.includes('~~~', 3)
        : !trimmed.endsWith('```');
      prevWasCode = trimmed.startsWith('```') && !trimmed.endsWith('```') || trimmed.startsWith('~~~') && !trimmed.endsWith('~~~');
      inList = false;
      continue;
    }

    // Skip trailing markdown in code blocks
    if (result.length > 0) {
      const lastLine = result[result.length - 1];
      const lastIsCodeStart = lastLine.startsWith('```') || lastLine.startsWith('~~~');
      const lastIsCodeEnd = (lastLine.startsWith('```') && lastLine.endsWith('```') && lastLine.length > 3) ||
        (lastLine.startsWith('~~~') && lastLine.endsWith('~~~') && lastLine.length > 3);
      if (lastIsCodeStart && !lastIsCodeEnd) {
        result.push(line); // Inside code block, preserve content
        continue;
      }
    }

    // Normalize list markers: use dash consistently
    const listMatch = trimmed.match(/^(\s*)([*+>])\s+(.+)$/);
    if (listMatch) {
      if (!inList && result.length > 0 && result[result.length - 1].trim() !== '') result.push('');
      result.push(`${listMatch[1]}- ${listMatch[3]}`);
      inList = true;
      continue;
    }

    // Numbered list - convert to dash if just sequential
    const numberedMatch = trimmed.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!inList && result.length > 0) result.push('');
      result.push(`${numberedMatch[1]}- ${numberedMatch[3]}`);
      inList = true;
      continue;
    }

    // Regular content
    if (trimmed !== '') {
      inList = false;
      result.push(line);
    } else {
      // Preserve single blank lines, collapse multiple
      if (result.length > 0 && result[result.length - 1].trim() !== '') {
        result.push('');
      }
    }
    prevWasCode = false;
  }

  // Remove trailing blank lines
  while (result.length > 0 && result[result.length - 1].trim() === '') {
    result.pop();
  }

  return result.join('\n');
}

/**
 * Format a chat/RAG response for better readability.
 * Adds line breaks and structure to answer text.
 */
export function formatChatResponse(text: string): string {
  // Ensure proper spacing around citations [N]
  let formatted = text.replace(/(\S)\[(\d+)\]/g, '$1 [$2]');

  // Add line break after answer prefix if long
  const firstLineBreak = formatted.indexOf('\n');
  if (firstLineBreak > 80 || firstLineBreak === -1) {
    // Keep as-is, markdown renderer handles wrapping
  }

  return formatted;
}
