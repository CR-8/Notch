import { useState, useEffect } from 'react';
import { getSettings, saveSettings, getAppearance, saveAppearance } from '../../lib/storage';
import type { Settings, GenerationMode, LLMProvider, AppearanceSettings } from '../../lib/types';
import { SUPPORTED_MODELS } from '../../lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

const DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api/v1';

// ── Provider definitions ────────────────────────────────────────────────────────

const PROVIDER_DEFS: Array<{ id: LLMProvider; label: string; description: string }> = [
  { id: 'anthropic', label: 'Anthropic', description: 'Claude API (api.anthropic.com)' },
  { id: 'openai-compatible', label: 'OpenRouter', description: 'OpenAI-compatible endpoints (openrouter.ai)' },
  { id: 'offline', label: 'Offline NLP', description: 'No API calls, keyword-based local answers' },
];

const MODE_DEFS: Array<{ mode: GenerationMode; label: string; description: string }> = [
  { mode: 'FAST', label: 'FAST', description: 'Fast captures, quick reads' },
  { mode: 'BALANCED', label: 'BALANCED', description: 'Balanced speed and quality' },
  { mode: 'DEEP', label: 'DEEP', description: 'Best quality for dense technical docs' },
  { mode: 'LOCAL', label: 'LOCAL', description: 'No API usage, unlimited local only' },
];

// ── Settings UI ─────────────────────────────────────────────────────────────────

export default function SettingsApp() {
  // API / Provider state
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<LLMProvider>('anthropic');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OPENROUTER_URL);
  const [modelId, setModelId] = useState('claude-3-5-sonnet-20241022');
  const [defaultMode, setDefaultMode] = useState<GenerationMode>('FAST');

  // Appearance state
  const [theme, setTheme] = useState<AppearanceSettings['theme']>('dark');
  const [fontFamily, setFontFamily] = useState<AppearanceSettings['fontFamily']>('mono');
  const [fontSize, setFontSize] = useState<AppearanceSettings['fontSize']>('md');
  const [accentColor, setAccentColor] = useState('#e07c3a');

  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    Promise.all([getSettings(), getAppearance()]).then(([s, a]) => {
      setApiKey(s.apiKey ?? '');
      setProvider(s.provider ?? 'anthropic');
      setBaseUrl(s.baseUrl !== undefined ? s.baseUrl : (s.provider === 'openai-compatible' ? DEFAULT_OPENROUTER_URL : ''));
      setModelId(s.modelId ?? 'claude-3-5-sonnet-20241022');
      setDefaultMode(s.defaultMode ?? 'FAST');
      setTheme(a.theme);
      setFontFamily(a.fontFamily);
      setFontSize(a.fontSize);
      setAccentColor(a.accentColor);

      // Apply appearance to document
      const resolved = a.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : a.theme;
      document.documentElement.dataset.theme = resolved;
      document.body.dataset.theme = resolved;
      document.documentElement.style.setProperty('--color-primary', a.accentColor);
    });
  }, []);

  async function handleSave() {
    const settings: Settings = {
      apiKey,
      provider,
      baseUrl: baseUrl.trim() || '',
      modelId,
      defaultMode,
    };
    const appearance: AppearanceSettings = {
      theme,
      fontFamily,
      fontSize,
      accentColor,
    };
    await Promise.all([saveSettings(settings), saveAppearance(appearance)]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const maskedKey = apiKey.length > 8
    ? apiKey.slice(0, 4) + '•'.repeat(apiKey.length - 8) + apiKey.slice(-4)
    : apiKey;

  return (
    <div className="bg-background min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="font-mono text-base font-semibold uppercase tracking-widest text-white mb-8">
        NOTCH — SETTINGS
      </h1>

      {/* API Key */}
      <section className="mb-8">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          API KEY
        </h2>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
              {provider === 'anthropic' ? 'ANTHROPIC' : provider === 'openai-compatible' ? 'OPENROUTER' : 'N/A'}
            </span>
            {apiKey.length > 0 && (
              <span className="font-mono text-[11px] text-primary font-semibold uppercase tracking-wider">
                [{maskedKey}]
              </span>
            )}
          </div>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs bg-background border-border text-white placeholder:text-muted pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted hover:text-white"
            >
              {showKey ? '[HIDE]' : '[SHOW]'}
            </button>
          </div>
          <p className="font-mono text-[10px] text-muted uppercase tracking-wide mt-2">
            Your key is stored locally and never sent anywhere except the selected provider.
          </p>
        </div>
      </section>

      {/* Model ID */}
      <section className="mb-8">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          MODEL
        </h2>
        <div className="card p-4 flex flex-col gap-3">
          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-1">Model ID</p>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full font-mono text-xs bg-background border border-border text-white px-3 py-2"
            >
              <optgroup label="Anthropic (Direct)">
                {SUPPORTED_MODELS.filter(m => m.id.startsWith('claude')).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
              <optgroup label="OpenRouter / Other">
                {SUPPORTED_MODELS.filter(m => !m.id.startsWith('claude')).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-1">Or enter custom model ID</p>
            <Input
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet"
              className="font-mono text-xs bg-background border-border text-white placeholder:text-muted"
            />
          </div>
        </div>
      </section>

      {/* Provider Selector */}
      <section className="mb-8">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          PROVIDER
        </h2>
        <div className="flex gap-3">
          {PROVIDER_DEFS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setProvider(item.id)}
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

      {/* Custom Endpoint URL - for OpenAI-compatible providers */}
      {provider !== 'offline' && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            ENDPOINT URL
          </h2>
          <div className="card p-4 flex flex-col gap-3">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide">
              {provider === 'anthropic'
                ? 'Leave empty for api.anthropic.com, or enter custom endpoint (e.g., http://localhost:8080/v1)'
                : 'Select a preset or enter your OpenAI-compatible API endpoint URL'}
            </p>
            {/* Preset buttons for common endpoints */}
            <div className="flex gap-2 flex-wrap">
              {provider === 'openai-compatible' && (
                <>
                  <button
                    type="button"
                    onClick={() => setBaseUrl('https://openrouter.ai/api/v1')}
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors',
                      baseUrl === 'https://openrouter.ai/api/v1'
                        ? 'border-primary text-primary'
                        : 'border-border text-muted hover:text-white'
                    )}
                  >
                    OPENROUTER
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseUrl('https://opencode.ai/v1')}
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors',
                      baseUrl === 'https://opencode.ai/v1'
                        ? 'border-primary text-primary'
                        : 'border-border text-muted hover:text-white'
                    )}
                  >
                    OPENCODE
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseUrl('https://api.minimax.chat/v1')}
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors',
                      baseUrl === 'https://api.minimax.chat/v1'
                        ? 'border-primary text-primary'
                        : 'border-border text-muted hover:text-white'
                    )}
                  >
                    MINIMAX
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseUrl('http://localhost:8080/v1')}
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors',
                      baseUrl === 'http://localhost:8080/v1'
                        ? 'border-primary text-primary'
                        : 'border-border text-muted hover:text-white'
                    )}
                  >
                    LOCALHOST
                  </button>
                </>
              )}
            </div>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider === 'anthropic' ? 'https://api.anthropic.com (default)' : DEFAULT_OPENROUTER_URL}
              className="font-mono text-xs bg-background border-border text-white placeholder:text-muted"
            />
            {baseUrl && (
              <p className="font-mono text-[10px] text-muted uppercase tracking-wide">
                Active endpoint: {baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}v1/chat/completions
              </p>
            )}
          </div>
        </section>
      )}

      {/* Mode Selector */}
      <section className="mb-8">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          DEFAULT MODE
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {MODE_DEFS.map(({ mode, label, description }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDefaultMode(mode)}
              className={cn(
                'card text-left transition-colors hover:bg-surface-hover p-4',
                defaultMode === mode && 'active-state'
              )}
            >
              <p className={cn(
                'font-mono text-xs font-semibold uppercase tracking-wider mb-1',
                defaultMode === mode ? 'text-primary' : 'text-white'
              )}>
                {label}
              </p>
              <p className="font-mono text-[10px] text-muted uppercase tracking-wide leading-relaxed">
                {description}
              </p>
            </button>
          ))}
        </div>
      </section>

      <Separator className="bg-border mb-6" />

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          APPEARANCE
        </h2>
        <div className="card p-4 flex flex-col gap-4">
          {/* Theme */}
          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-2">Theme</p>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'flex-1 border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors',
                    theme === t ? 'border-primary text-primary' : 'border-border text-muted hover:text-white'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-2">Font Family</p>
            <div className="flex gap-2">
              {(['mono', 'serif', 'sans'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFontFamily(f)}
                  className={cn(
                    'flex-1 border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors',
                    fontFamily === f ? 'border-primary text-primary' : 'border-border text-muted hover:text-white',
                    f === 'mono' && 'font-mono',
                    f === 'serif' && 'font-serif',
                    f === 'sans' && 'font-sans'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <p className="font-mono text-xs text-muted uppercase tracking-wide mb-2">Font Size</p>
            <div className="flex gap-2">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={cn(
                    'flex-1 border px-3 py-2 font-mono uppercase tracking-wider transition-colors',
                    fontSize === s ? 'border-primary text-primary' : 'border-border text-muted hover:text-white',
                    s === 'sm' && 'text-[10px]',
                    s === 'md' && 'text-[12px]',
                    s === 'lg' && 'text-[14px]'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-2">Accent Color</p>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-10 h-10 border border-border cursor-pointer"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#e07c3a"
                className="font-mono text-xs bg-background border-border text-white w-28"
              />
              <span
                className="w-8 h-8 border border-border"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>
        </div>
      </section>

      <button onClick={handleSave} className="btn btn-primary min-w-[180px]">
        {saved ? '[SAVED ✓]' : '[SAVE SETTINGS]'}
      </button>
    </div>
  );
}