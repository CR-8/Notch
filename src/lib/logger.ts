/**
 * Notch Global Logger
 *
 * Single control point: set LOGGING_ENABLED = true for dev/debug, false for production.
 *
 * Usage:
 *   import { log } from '@/lib/logger';
 *   log.info('background', 'Capture started', { tabId });
 *   log.success('storage', 'Document saved', { id: doc.id });
 *   log.error('ai-client', 'API call failed', error);
 *   log.warn('quota', 'Storage near limit', { pct: 91 });
 */

// ─── MASTER SWITCH ────────────────────────────────────────────────────────────
// Auto-disabled in production builds. Override via env var for debugging.
const LOGGING_ENABLED = process.env.NODE_ENV !== 'production';

// ─── Types ────────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'success' | 'warn' | 'error';

interface LogEntry {
  ts: string; // ISO timestamp
  level: LogLevel;
  module: string; // e.g. 'background', 'ai-client', 'storage'
  message: string;
  data?: unknown;
}

// ─── Styles (console group colours) ──────────────────────────────────────────

const STYLES: Record<LogLevel, string> = {
  info: 'color:#5E6AD2;font-weight:600', // violet
  success: 'color:#22c55e;font-weight:600', // green
  warn: 'color:#f59e0b;font-weight:600', // amber
  error: 'color:#FF3366;font-weight:600', // danger red
};

const ICONS: Record<LogLevel, string> = {
  info: 'ℹ',
  success: '✓',
  warn: '⚠',
  error: '✗',
};

// ─── PRIV-7: API key redaction ────────────────────────────────────────────────
// Patterns that look like API keys / bearer tokens — redacted before logging.
const KEY_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9\-_]{20,}/g, // Anthropic
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI-style
  /eyJ[A-Za-z0-9\-_.+/]{30,}/g, // JWT / bearer
  /Bearer\s+[A-Za-z0-9\-_.+/]{20,}/gi, // Authorization header
  /(?<=["\s=:,])([A-Za-z0-9_-]{32,})/g, // Generic long random strings in key position
];

function redact(value: string): string {
  let s = value;
  for (const pat of KEY_PATTERNS) {
    s = s.replace(pat, '[REDACTED]');
  }
  return s;
}

function redactData(data: unknown): unknown {
  if (data === undefined || data === null) return data;
  if (data instanceof Error) return data; // don't mangle Error objects
  try {
    const json = JSON.stringify(data);
    const clean = redact(json);
    return JSON.parse(clean);
  } catch {
    return data;
  }
}

// ─── In-memory log buffer (last 200 entries) ──────────────────────────────────

const MAX_BUFFER = 200;
const _buffer: LogEntry[] = [];

function record(level: LogLevel, module: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    module,
    message: redact(message),
    data: redactData(data),
  };

  _buffer.push(entry);
  if (_buffer.length > MAX_BUFFER) _buffer.shift();

  if (!LOGGING_ENABLED) return;

  const prefix = `%c[NOTCH:${module.toUpperCase()}] ${ICONS[level]} ${message}`;

  if (data !== undefined) {
    if (level === 'error' && data instanceof Error) {
      console.groupCollapsed(prefix, STYLES[level]);
      console.error(data);
      console.groupEnd();
    } else {
      console.groupCollapsed(prefix, STYLES[level]);
      console.log(data);
      console.groupEnd();
    }
  } else {
    console.log(prefix, STYLES[level]);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const log = {
  /** General informational event */
  info(module: string, message: string, data?: unknown) {
    record('info', module, message, data);
  },

  /** Operation completed successfully */
  success(module: string, message: string, data?: unknown) {
    record('success', module, message, data);
  },

  /** Non-fatal warning */
  warn(module: string, message: string, data?: unknown) {
    record('warn', module, message, data);
  },

  /** Error — always recorded in buffer even when LOGGING_ENABLED = false */
  error(module: string, message: string, data?: unknown) {
    // Errors always go to buffer regardless of LOGGING_ENABLED
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level: 'error',
      module,
      message,
      data,
    };
    _buffer.push(entry);
    if (_buffer.length > MAX_BUFFER) _buffer.shift();

    if (!LOGGING_ENABLED) return;
    const prefix = `%c[NOTCH:${module.toUpperCase()}] ${ICONS.error} ${message}`;
    console.groupCollapsed(prefix, STYLES.error);
    if (data instanceof Error) {
      console.error(data);
    } else if (data !== undefined) {
      console.log(data);
    }
    console.groupEnd();
  },

  /**
   * Dump the full in-memory log buffer to the console.
   * Useful for inspecting recent activity even when LOGGING_ENABLED = false.
   */
  dump() {
    console.table(
      _buffer.map((e) => ({
        time: e.ts.slice(11, 23),
        level: e.level,
        module: e.module,
        message: e.message,
      })),
    );
  },

  /** Returns a copy of the current log buffer */
  getBuffer(): ReadonlyArray<LogEntry> {
    return [..._buffer];
  },
};
