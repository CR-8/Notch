import { motion } from 'motion/react';
import { Sun, Moon, Monitor } from 'lucide-react';

const ACCENTS = [
  '#0a84ff',
  '#9065b0',
  '#30d158',
  '#ff9f40',
  '#ff6b6b',
  '#2a9d99',
  '#ff64c8',
  '#111111',
];

const THEMES = [
  { id: 'light' as const, label: 'Light', icon: Sun },
  { id: 'dark' as const, label: 'Dark', icon: Moon },
  { id: 'system' as const, label: 'System', icon: Monitor },
];

const FONTS = [
  { id: 'sans' as const, label: 'Sans-serif' },
  { id: 'serif' as const, label: 'Serif' },
  { id: 'mono' as const, label: 'Monospace' },
];

const SIZES = [
  { id: 'sm' as const, label: 'Small', preview: 'Aa' },
  { id: 'md' as const, label: 'Medium', preview: 'Aa' },
  { id: 'lg' as const, label: 'Large', preview: 'Aa' },
];

export function PersonalizeStep({
  config,
  onChange,
}: {
  config: {
    theme: 'dark' | 'light' | 'system';
    accentColor: string;
    fontFamily: 'sans' | 'serif' | 'mono';
    fontSize: 'sm' | 'md' | 'lg';
  };
  onChange: (patch: Partial<typeof config>) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center max-w-md">
        <h2 className="text-[26px] font-bold text-ink mb-2 tracking-[-0.02em]">
          Personalise your experience
        </h2>
        <p className="text-[14px] text-ink-muted">Choose how Notch looks and feels.</p>
      </div>

      <div className="w-full max-w-md space-y-5">
        {/* Theme */}
        <div>
          <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-2 block">
            Theme
          </label>
          <div className="flex gap-2">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const active = config.theme === t.id;
              return (
                <motion.button
                  key={t.id}
                  onClick={() => onChange({ theme: t.id })}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-hairline bg-card text-ink-muted hover:border-ink-faint hover:text-ink'
                  }`}
                  aria-pressed={active}
                >
                  <Icon size={18} />
                  <span className="text-[12px] font-medium">{t.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Accent color */}
        <div>
          <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-2 block">
            Accent colour
          </label>
          <div className="flex gap-2.5 flex-wrap">
            {ACCENTS.map((color) => {
              const active = config.accentColor === color;
              return (
                <motion.button
                  key={color}
                  onClick={() => onChange({ accentColor: color })}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    active ? 'border-ink scale-110 shadow-sm' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Accent ${color}`}
                  aria-pressed={active}
                />
              );
            })}
          </div>
        </div>

        {/* Font */}
        <div>
          <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-2 block">
            Font style
          </label>
          <div className="flex gap-2">
            {FONTS.map((f) => {
              const active = config.fontFamily === f.id;
              return (
                <motion.button
                  key={f.id}
                  onClick={() => onChange({ fontFamily: f.id })}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex-1 py-3 rounded-xl border text-center text-[13px] font-medium transition-all ${
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-hairline bg-card text-ink-muted hover:border-ink-faint'
                  }`}
                  aria-pressed={active}
                >
                  {f.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Font size */}
        <div>
          <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-2 block">
            Text size
          </label>
          <div className="flex gap-2">
            {SIZES.map((s) => {
              const active = config.fontSize === s.id;
              return (
                <motion.button
                  key={s.id}
                  onClick={() => onChange({ fontSize: s.id })}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex-1 py-3 rounded-xl border text-center transition-all ${
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-hairline bg-card text-ink-muted hover:border-ink-faint'
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className={`font-semibold ${
                      s.id === 'sm' ? 'text-[14px]' : s.id === 'md' ? 'text-[16px]' : 'text-[18px]'
                    }`}
                  >
                    {s.preview}
                  </span>
                  <p className="text-[10px] mt-0.5">{s.label}</p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
