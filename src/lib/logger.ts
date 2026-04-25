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
// Set to false before shipping to production. One change, all logging stops.
const LOGGING_ENABLED = true;

// ─── Types ────────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'success' | 'warn' | 'error';

interface LogEntry {
  ts: string;          // ISO timestamp
  level: LogLevel;
  module: string;      // e.g. 'background', 'ai-client', 'storage'
  message: string;
  data?: unknown;
}

// ─── Styles (console group colours) ──────────────────────────────────────────

const STYLES: Record<LogLevel, string> = {
  info:    'color:#5E6AD2;font-weight:600',   // violet
  success: 'color:#22c55e;font-weight:600',   // green
  warn:    'color:#f59e0b;font-weight:600',   // amber
  error:   'color:#FF3366;font-weight:600',   // danger red
};

const ICONS: Record<LogLevel, string> = {
  info:    'ℹ',
  success: '✓',
  warn:    '⚠',
  error:   '✗',
};

// ─── In-memory log buffer (last 200 entries) ──────────────────────────────────

const MAX_BUFFER = 200;
const _buffer: LogEntry[] = [];

function record(level: LogLevel, module: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    module,
    message,
    data,
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
    console.table(_buffer.map(e => ({
      time: e.ts.slice(11, 23),
      level: e.level,
      module: e.module,
      message: e.message,
    })));
  },

  /** Returns a copy of the current log buffer */
  getBuffer(): ReadonlyArray<LogEntry> {
    return [..._buffer];
  },
};
