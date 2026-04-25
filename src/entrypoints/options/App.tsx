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
              {description}
            </p>
            <p className="font-mono text-[9px] text-[#444] uppercase tracking-wide">
              {model}
            </p>
            <p className="font-mono text-[9px] text-primary uppercase tracking-wide mt-1">
  const [provider, setProvider] = useState<Settings['provider']>('offline');
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

const PROVIDER_DEFS: Array<{ id: SupportedProvider; label: string; description: string }> = [
  { id: 'gemini', label: 'Gemini Cloud', description: 'Google-hosted generation using API key' },
  { id: 'ollama', label: 'Ollama Local', description: 'Run local LLM via http://localhost:11434' },
  { id: 'offline', label: 'Offline NLP', description: 'No LLM calls, keyword-based local answers' },
];

function ProviderSelector({
  provider,
  onSelect,
}: {
  provider: SupportedProvider;
  onSelect: (provider: SupportedProvider) => void;
}) {
  return (
    <section className="mb-8">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
        ANSWER PROVIDER
      </h2>
      <div className="flex gap-3">
        {PROVIDER_DEFS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              'card flex-1 p-4 text-left transition-colors hover:bg-surface-hover',
              provider === item.id && 'active-state'
            )}
          >
            <p className={cn(
              'font-mono text-xs font-semibold uppercase tracking-wider mb-1',
              provider === item.id ? 'text-primary' : 'text-white'
            )}>
              {item.label}
            </p>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide leading-relaxed">
              {item.description}
            </p>
          </button>
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
  const [provider, setProvider] = useState<SupportedProvider>('offline');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      const g = s.apiKeys.gemini ?? '';
      setGeminiKey(g);
      setGeminiVal(getValidation(g));
      setMode(s.defaultMode);
      setProvider(s.provider ?? 'offline');
      setOllamaEndpoint(s.ollamaEndpoint || 'http://localhost:11434');
      setOllamaModel(s.ollamaModel || 'llama3');
    });
  }, []);

  async function handleSave() {
    const settings: Settings = {
      apiKeys: { gemini: geminiKey || undefined },
      provider,
      ollamaEndpoint,
      defaultMode: mode,
      ollamaModel,
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

      {provider === 'ollama' && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            OLLAMA CONNECTION
          </h2>
          <div className="card p-4 flex flex-col gap-3">
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-1">Endpoint</p>
              <Input
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="font-mono text-xs bg-background border-border text-white placeholder:text-muted"
              />
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-1">Model</p>
              <Input
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="llama3"
                className="font-mono text-xs bg-background border-border text-white placeholder:text-muted"
              />
            </div>
          </div>
        </section>
      )}

      {provider === 'offline' && (
        <section className="mb-8">
          <div className="card p-4">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide leading-relaxed">
              Offline mode uses local embeddings and keyword-based NLP answers with no network calls.
            </p>
          </div>
        </section>
      )}

      <ModelSelector activeMode={mode} onSelect={setMode} />

      <Separator className="bg-border mb-6" />

      <button onClick={handleSave} className="btn btn-primary min-w-[180px]">
        {saved ? '[SETTINGS SAVED ✓]' : '[SAVE SETTINGS]'}
      </button>
    </div>
  );
}
