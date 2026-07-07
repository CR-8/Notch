import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { tagColor } from './data';

export function TagInput({
  tags,
  onTagsChange,
  recent,
}: {
  tags: string[];
  onTagsChange: (t: string[]) => void;
  recent: string[];
}) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t || tags.includes(t)) {
      setInput('');
      return;
    }
    onTagsChange([...tags, t]);
    setInput('');
  };

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    return recent
      .filter((t) => !tags.includes(t))
      .filter((t) => (q ? t.includes(q) : true))
      .slice(0, 6);
  }, [recent, tags, input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onTagsChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint px-0.5">
        Tags
      </span>

      <div className="relative">
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5 rounded-xl bg-surface border px-2.5 py-2 transition-colors',
            focused
              ? 'border-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_15%,transparent)]'
              : 'border-hairline',
          )}
        >
          <AnimatePresence initial={false}>
            {tags.map((tag) => {
              const c = tagColor(tag);
              return (
                <motion.span
                  key={tag}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 34 }}
                  className={cn(
                    'inline-flex items-center gap-1 text-[11.5px] font-medium rounded-md pl-1.5 pr-1 py-0.5',
                    c.chip,
                    c.text,
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
                  {tag}
                  <button
                    onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
                    className="ml-0.5 w-3.5 h-3.5 grid place-items-center rounded hover:bg-black/5 leading-none opacity-70 hover:opacity-100"
                    aria-label={`Remove ${tag}`}
                  >
                    &times;
                  </button>
                </motion.span>
              );
            })}
          </AnimatePresence>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // slight delay so a suggestion click registers before blur hides it
              setTimeout(() => setFocused(false), 120);
            }}
            placeholder={tags.length ? 'Add another…' : 'Add tags to organize…'}
            className="flex-1 min-w-[90px] bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-faint py-0.5"
          />
        </div>

        <AnimatePresence>
          {focused && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl bg-surface border border-hairline shadow-level-2 p-1.5"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint px-2 py-1">
                Recent
              </p>
              <div className="flex flex-wrap gap-1.5 p-1">
                {suggestions.map((s) => {
                  const c = tagColor(s);
                  return (
                    <button
                      key={s}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        add(s);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 text-[11.5px] font-medium rounded-md px-2 py-1 transition-transform active:scale-95',
                        c.chip,
                        c.text,
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
                      {s}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
