import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../../lib/storage';
import { validateGeminiKey } from '../../lib/validation';
import type { Settings, GenerationMode } from '../../lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

type ValidationState = 'valid' | 'invalid' | 'empty';

function getValidation(key: string): ValidationState {
  if (!key) return 'empty';
  return validateGeminiKey(key);
}

// ── Getting started ───────────────────────────────────────────────────────────
function GettingStartedSection() {
  return (
    <section className="mb-8">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
        GETTING STARTED
      </h2>
      <div className="card p-4">
        <p className="font-mono text-xs uppercase tracking-wider text-muted mb-2">
          Add your Google AI Studio API key to start capturing pages.
        </p>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs uppercase tracking-wider text-primary hover:underline"
        >
          GET YOUR FREE API KEY ↗
        </a>
      </div>
    </section>
  );
}

// ── Model selector ────────────────────────────────────────────────────────────

const MODEL_DEFS: { mode: GenerationMode; label: string; model: string; description: string; quota: string }[] = [
  {
    mode: 'FAST',
    label: 'FAST',
    model: 'gemini-3.1-flash-lite-preview',
    description: 'Fastest captures, best for quick reads',
    quota: '500 req/day free',
  },
  {
    mode: 'BALANCED',
    label: 'BALANCED',
    model: 'gemma-3-12b-it',
    description: 'Good quality, higher daily quota',
    quota: '14,400 req/day free',
  },
  {
    mode: 'DEEP',
    label: 'DEEP',
    model: 'gemma-3-27b-it',
    description: 'Best quality structured notes',
    quota: '14,400 req/day free',
  },
];

function ModelSelector({ activeMode, onSelect }: { activeMode: GenerationMode; onSelect: (m: GenerationMode) => void }) {
  return (
    <section className="mb-8">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
        CAPTURE MODEL
      </h2>
      <div className="flex gap-3">
        {MODEL_DEFS.map(({ mode, label, model, description, quota }) => (
          <div
            key={mode}
            onClick={() => onSelect(mode)}
            className={cn(
              'card flex-1 p-4 cursor-pointer transition-colors hover:bg-surface-hover',
              activeMode === mode && 'active-state'
            )}
          >
            <p className={cn(
              'font-mono text-xs font-semibold uppercase tracking-wider mb-1',
              activeMode === mode ? 'text-primary' : 'text-white'
            )}>
              {label}
            </p>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-2 leading-relaxed">
              {description}
            </p>
            <p className="font-mono text-[9px] text-[#444] uppercase tracking-wide">
              {model}
            </p>
            <p className="font-mono text-[9px] text-primary uppercase tracking-wide mt-1">
              {quota}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function SettingsApp() {
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiVal, setGeminiVal] = useState<ValidationState>('empty');
  const [mode, setMode] = useState<GenerationMode>('FAST');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      const g = s.apiKeys.gemini ?? '';
      setGeminiKey(g);
      setGeminiVal(getValidation(g));
      setMode(s.defaultMode);
    });
  }, []);

  async function handleSave() {
    const settings: Settings = {
      apiKeys: { gemini: geminiKey || undefined },
      ollamaEndpoint: 'http://localhost:11434',
      defaultMode: mode,
      ollamaModel: 'llama3',
    };
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-background min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="font-mono text-base font-semibold uppercase tracking-widest text-white mb-8">
        NOTCH — SETTINGS
      </h1>

      <GettingStartedSection />

      {/* API Key */}
      <section className="mb-8">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          GOOGLE AI STUDIO API KEY
        </h2>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
              GEMINI
            </span>
            {geminiVal !== 'empty' && (
              <span className={cn(
                'font-mono text-[11px] font-semibold uppercase tracking-wider',
                geminiVal === 'valid' ? 'text-primary' : 'text-danger'
              )}>
                {geminiVal === 'valid' ? '[VERIFIED]' : '[INVALID]'}
              </span>
            )}
          </div>
          <Input
            type="password"
            value={geminiKey}
            placeholder="AIza..."
            onChange={(e) => { setGeminiKey(e.target.value); setGeminiVal(getValidation(e.target.value)); }}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs bg-background border-border text-white placeholder:text-muted"
          />
          <p className="font-mono text-[10px] text-muted uppercase tracking-wide mt-2">
            Free tier — no credit card required.{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get key ↗
            </a>
          </p>
        </div>
      </section>

      <ModelSelector activeMode={mode} onSelect={setMode} />

      <Separator className="bg-border mb-6" />

      <button onClick={handleSave} className="btn btn-primary min-w-[180px]">
        {saved ? '[SETTINGS SAVED ✓]' : '[SAVE SETTINGS]'}
      </button>
    </div>
  );
}
