import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ModelOption } from '@/lib/models-api';

interface ModelComboboxProps {
  value: string;
  onChange: (id: string) => void;
  options: ModelOption[];
  loading?: boolean;
  error?: string;
  /** Re-fetch the model list (e.g. after the key/URL changes). */
  onRefresh?: () => void;
  placeholder?: string;
}

function formatContext(n?: number): string {
  if (!n) return '';
  if (n >= 1000) return `${Math.round(n / 1000)}k ctx`;
  return `${n} ctx`;
}

/**
 * Searchable model picker. Behaves like a combo box: the field shows the selected
 * model id, clicking opens a filtered dropdown, and typing narrows the list in real
 * time. Selecting commits the id. Free-text is preserved, so custom/unlisted models
 * still work even when discovery returns nothing.
 */
export function ModelCombobox({
  value,
  onChange,
  options,
  loading,
  error,
  onRefresh,
  placeholder = 'Search models…',
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep the field in sync when the value changes externally (e.g. preset click).
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // When the field still shows the committed value, list everything.
    if (!q || q === value.toLowerCase()) return options;
    return options.filter(
      (o) => o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q),
    );
  }, [query, value, options]);

  useEffect(() => { setHighlight(0); }, [query, open]);

  function commit(id: string) {
    onChange(id);
    setQuery(id);
    setOpen(false);
  }

  // Called when the field loses focus / closes without an explicit selection. We
  // only ever push a *non-empty* value up: typed custom text commits as a custom
  // model, but an empty/whitespace field reverts to the last committed value so we
  // never clobber the selection with "" (which the parent would heal to a default).
  function reconcile() {
    setOpen(false);
    const trimmed = query.trim();
    if (!trimmed) { setQuery(value); return; }
    if (trimmed !== value) onChange(trimmed);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) commit(filtered[highlight].id);
      else reconcile(); // commit typed custom id
    } else if (e.key === 'Escape') { setQuery(value); setOpen(false); }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          value={query}
          // Typing only filters the list — the committed model id is unchanged until
          // a row is selected or the field is blurred (see reconcile). This prevents
          // partial/empty text from leaking up and being "healed" to a default.
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { window.setTimeout(reconcile, 120); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="notion-input w-full pr-16 text-[13px]"
          role="combobox"
          aria-expanded={open}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {onRefresh && (
            <button
              type="button"
              onClick={() => { onRefresh(); setOpen(true); }}
              title="Reload models"
              className="text-[11px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] px-1"
            >
              {loading ? '…' : '↻'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle model list"
            className="text-[var(--color-ink-muted)] hover:text-[var(--color-primary)]"
          >
            ▾
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-[var(--color-hairline)] bg-white shadow-lg py-1">
          {loading && (
            <div className="px-3 py-2 text-[12px] text-[var(--color-ink-muted)]">Loading models…</div>
          )}
          {!loading && error && (
            <div className="px-3 py-2 text-[12px] text-[var(--color-destructive)]">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-[var(--color-ink-muted)]">
              No matches. Press Enter to use “{query}” as a custom model.
            </div>
          )}
          {!loading && filtered.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(o.id); }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors',
                i === highlight ? 'bg-[var(--color-primary)]/8' : 'hover:bg-[var(--color-canvas-soft)]',
                o.id === value && 'font-semibold',
              )}
            >
              <span className="min-w-0">
                <span className="block text-[13px] text-[var(--color-ink)] truncate">{o.name}</span>
                <span className="block text-[11px] text-[var(--color-ink-faint)] truncate">{o.id}</span>
              </span>
              <span className="shrink-0 flex items-center gap-1.5">
                {o.free && (
                  <span className="text-[10px] font-semibold text-[var(--color-primary)] border border-[var(--color-primary)]/40 rounded-full px-1.5 py-0.5">
                    FREE
                  </span>
                )}
                {o.contextLength ? (
                  <span className="text-[10px] text-[var(--color-ink-faint)]">{formatContext(o.contextLength)}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
