import { useState, useEffect } from 'react';
import { getSettings, saveSettings, getAppearance, saveAppearance } from '../../lib/storage';
import type { Settings, GenerationMode, LLMProvider, AppearanceSettings, AIModel } from '../../lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api';
const DEFAULT_OPENCODE_URL = 'https://opencode.ai/zen';
const DEFAULT_MINIMAX_URL = 'https://api.minimax.chat/v1';

const PROVIDER_DEFS: Array<{ id: LLMProvider; label: string; description: string }> = [
  { id: 'anthropic', label: 'Anthropic', description: 'Direct Claude API (api.anthropic.com)' },
  { id: 'openai-compatible', label: 'OpenAI Compatible', description: 'OpenRouter, OpenCode, MiniMax, etc.' },
  { id: 'offline', label: 'Offline', description: 'Local keyword-based processing only' },
];

const MODE_DEFS: Array<{ mode: GenerationMode; label: string; description: string }> = [
  { mode: 'FAST', label: 'FAST', description: 'Quick captures, faster processing' },
  { mode: 'BALANCED', label: 'BALANCED', description: 'Balance between speed and quality' },
  { mode: 'DEEP', label: 'DEEP', description: 'Best quality for dense technical docs' },
  { mode: 'LOCAL', label: 'LOCAL', description: 'No API, unlimited local only' },
];

const ENDPOINT_PRESETS = [
  { label: 'OPENROUTER', url: 'https://openrouter.ai/api/' },
  { label: 'OPENCODE', url: 'https://opencode.ai/zen' },
  { label: 'LOCAL', url: 'http://localhost:8080/v1' },
];

// Default models for different providers (shown when API fetch fails)
const DEFAULT_PROVIDER_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-3-5-sonnet-20241022',
  'openai-compatible': 'openai/gpt-4o',
  offline: 'local',
};

interface RemoteModel {
  id: string;
  name: string;
  contextWindow?: number;
}

export default function SettingsApp() {
  // API / Provider state
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<LLMProvider>('anthropic');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('claude-3-5-sonnet-20241022');
  const [defaultMode, setDefaultMode] = useState<GenerationMode>('FAST');

  // Remote models state
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Appearance state
  const [theme, setTheme] = useState<AppearanceSettings['theme']>('dark');
  const [fontFamily, setFontFamily] = useState<AppearanceSettings['fontFamily']>('mono');
  const [fontSize, setFontSize] = useState<AppearanceSettings['fontSize']>('md');
  const [accentColor, setAccentColor] = useState('#e07c3a');

  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSettings(), getAppearance()]).then(([s, a]) => {
      setApiKey(s.apiKey ?? '');
      setProvider(s.provider ?? 'anthropic');
      // Load saved baseUrl or set default based on provider
      if (s.baseUrl) {
        setBaseUrl(s.baseUrl);
      } else if (s.provider === 'openai-compatible') {
        setBaseUrl(DEFAULT_OPENROUTER_URL);
      } else {
        setBaseUrl('');
      }
      setModelId(s.modelId ?? 'claude-3-5-sonnet-20241022');
      setDefaultMode(s.defaultMode ?? 'FAST');
      setTheme(a.theme);
      setFontFamily(a.fontFamily);
      setFontSize(a.fontSize);
      setAccentColor(a.accentColor);
      setLoading(false);

      // Apply appearance
      applyAppearance(a);
    });
  }, []);

  function applyAppearance(a: AppearanceSettings) {
    const resolved = a.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : a.theme;
    document.documentElement.dataset.theme = resolved;
    document.body.dataset.theme = resolved;
    document.documentElement.style.setProperty('--color-primary', a.accentColor);
  }

  async function fetchRemoteModels(url: string) {
    if (!url || provider === 'anthropic' || provider === 'offline') {
      setRemoteModels([]);
      return;
    }
    setLoadingModels(true);
    try {
      const modelsUrl = url.endsWith('/') ? url + 'models' : url + '/models';
      const response = await fetch(modelsUrl, { credentials: 'omit' });
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();

      let models: RemoteModel[] = [];
      if (url.includes('openrouter.ai')) {
        // OpenRouter: data.data is array of models
        models = (data.data || []).map((m: { id: string; name?: string; context_length?: number }) => ({
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.context_length,
        }));
      } else if (url.includes('opencode.ai')) {
        // OpenCode: data is array of models (requires auth, may fail)
        models = (data.data || data || []).map((m: { id: string; name?: string; context_length?: number }) => ({
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.context_length,
        }));
      } else {
        // Generic fallback
        models = (data.data || []).map((m: { id: string; name?: string }) => ({
          id: m.id,
          name: m.name || m.id,
        }));
      }
      // Sort by name
      models.sort((a, b) => a.name.localeCompare(b.name));
      setRemoteModels(models);
    } catch (err) {
      console.error('Failed to fetch models:', err);
      // Set fallback popular models for OpenAI-compatible when fetch fails
      setRemoteModels([
        { id: 'openai/gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
        { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', contextWindow: 1000000 },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000 },
        { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', contextWindow: 32000 },
      ]);
    } finally {
      setLoadingModels(false);
    }
  }

  // Fetch models when baseUrl or provider changes
  useEffect(() => {
    if (provider === 'openai-compatible' && baseUrl) {
      fetchRemoteModels(baseUrl);
    } else {
      setRemoteModels([]);
    }
  }, [baseUrl, provider]);

  async function handleSave() {
    const settings: Settings = {
      apiKey,
      provider,
      baseUrl: baseUrl.trim(),
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
    applyAppearance(appearance);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const maskedKey = apiKey.length > 8
    ? apiKey.slice(0, 4) + '•'.repeat(apiKey.length - 8) + apiKey.slice(-4)
    : apiKey;

  function handleProviderChange(p: LLMProvider) {
    setProvider(p);
    // Set appropriate default baseUrl and model when switching provider
    if (p === 'anthropic') {
      setBaseUrl('');
      setModelId('claude-3-5-sonnet-20241022');
    } else if (p === 'openai-compatible') {
      // Default to OpenRouter with GPT-4o as fallback model
      if (!baseUrl) {
        setBaseUrl(DEFAULT_OPENROUTER_URL);
      }
      // Set a default model - will be updated after fetching if available
      setModelId('openai/gpt-4o');
    } else if (p === 'offline') {
      setModelId('local');
    }
  }

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">LOADING...</span>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-surface px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/newtab.html" className="font-mono font-bold text-xl text-primary hover:text-white transition-colors">
              NOTCH
            </a>
            <span className="font-mono text-xs text-muted uppercase tracking-widest">/ SETTINGS</span>
          </div>
          <button
            onClick={handleSave}
            className={cn(
              'font-mono text-xs uppercase tracking-wider px-4 py-2 transition-colors',
              saved
                ? 'bg-primary text-background'
                : 'bg-primary text-background hover:bg-primary/80'
            )}
          >
            {saved ? '[SAVED ✓]' : '[SAVE]'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-8 space-y-8">
        {/* API Configuration */}
        <section className="card p-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="text-primary">01</span> API CONFIGURATION
          </h2>

          {/* Provider */}
          <div className="mb-6">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-3">PROVIDER</p>
            <div className="grid grid-cols-3 gap-3">
              {PROVIDER_DEFS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleProviderChange(item.id)}
                  className={cn(
                    'p-4 border text-left transition-all hover:border-primary/50',
                    provider === item.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface'
                  )}
                >
                  <p className={cn(
                    'font-mono text-xs font-semibold uppercase tracking-wider mb-1',
                    provider === item.id ? 'text-primary' : 'text-white'
                  )}>
                    {item.label}
                  </p>
                  <p className="font-mono text-[9px] text-muted leading-tight">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="mb-6">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-2">API KEY</p>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : provider === 'offline' ? 'Not required' : 'sk-...'}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={provider === 'offline'}
                className="font-mono text-sm bg-background border-border text-white placeholder:text-muted pr-12"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted hover:text-white"
              >
                {showKey ? '[HIDE]' : '[SHOW]'}
              </button>
            </div>
            {apiKey && (
              <p className="font-mono text-[10px] text-primary mt-2">[{maskedKey}]</p>
            )}
          </div>

          {/* Endpoint URL - only for non-offline */}
          {provider !== 'offline' && (
            <div className="mb-6">
              <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-3">ENDPOINT</p>

              {/* Preset buttons */}
              <div className="flex gap-2 mb-3">
                {ENDPOINT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setBaseUrl(preset.url)}
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors',
                      baseUrl === preset.url
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-muted hover:text-white hover:border-primary/50'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={provider === 'anthropic' ? 'https://api.anthropic.com (default)' : 'https://openrouter.ai/api/v1'}
                className="font-mono text-sm bg-background border-border text-white placeholder:text-muted"
              />

              {baseUrl && (
                <p className="font-mono text-[9px] text-muted mt-2">
                  → {baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}v1/chat/completions
                </p>
              )}
            </div>
          )}

          {/* Model ID */}
          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-2">MODEL</p>
            {provider === 'anthropic' ? (
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full font-mono text-sm bg-background border border-border text-white px-3 py-2"
              >
                <optgroup label="Anthropic (Direct)">
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                  <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                </optgroup>
              </select>
            ) : provider === 'openai-compatible' ? (
              <select
                value={remoteModels.some(m => m.id === modelId) ? modelId : 'custom'}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full font-mono text-sm bg-background border border-border text-white px-3 py-2"
                disabled={loadingModels}
              >
                {loadingModels ? (
                  <option value="">Loading models...</option>
                ) : remoteModels.length > 0 ? (
                  <>
                    <optgroup label="Available Models">
                      {remoteModels.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Custom">
                      <option value="custom">Custom Model ID...</option>
                    </optgroup>
                  </>
                ) : (
                  <optgroup label="Custom">
                    <option value="custom">Custom Model ID...</option>
                  </optgroup>
                )}
              </select>
            ) : (
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full font-mono text-sm bg-background border border-border text-white px-3 py-2"
              >
                <option value="local">Local Only</option>
              </select>
            )}
            {(modelId === 'custom' || (provider === 'openai-compatible' && !remoteModels.some(m => m.id === modelId))) && (
              <Input
                placeholder="e.g., openai/gpt-4o, google/gemini-2.0-flash-exp"
                value={provider === 'openai-compatible' && !remoteModels.some(m => m.id === modelId) && modelId !== 'custom' ? modelId : ''}
                onChange={(e) => setModelId(e.target.value)}
                className="font-mono text-sm bg-background border-border text-white mt-2 placeholder:text-muted"
              />
            )}
          </div>
        </section>

        {/* Capture Settings */}
        <section className="card p-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="text-primary">02</span> CAPTURE SETTINGS
          </h2>

          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-3">DEFAULT MODE</p>
            <div className="grid grid-cols-2 gap-3">
              {MODE_DEFS.map(({ mode, label, description }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDefaultMode(mode)}
                  className={cn(
                    'p-4 border text-left transition-all hover:border-primary/50',
                    defaultMode === mode
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface'
                  )}
                >
                  <p className={cn(
                    'font-mono text-xs font-semibold uppercase tracking-wider mb-1',
                    defaultMode === mode ? 'text-primary' : 'text-white'
                  )}>
                    {label}
                  </p>
                  <p className="font-mono text-[9px] text-muted leading-tight">
                    {description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="card p-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="text-primary">03</span> APPEARANCE
          </h2>

          {/* Theme */}
          <div className="mb-6">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-3">THEME</p>
            <div className="flex gap-3">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'flex-1 border px-4 py-3 font-mono text-sm uppercase tracking-wider transition-all',
                    theme === t
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-border text-muted hover:text-white hover:border-primary/50'
                  )}
                >
                  {t === 'dark' && '☾ DARK'}
                  {t === 'light' && '☀ LIGHT'}
                  {t === 'system' && '◐ SYSTEM'}
                </button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div className="mb-6">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-3">FONT FAMILY</p>
            <div className="flex gap-3">
              {(['mono', 'serif', 'sans'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFontFamily(f)}
                  className={cn(
                    'flex-1 border px-4 py-3 font-mono text-sm uppercase tracking-wider transition-all',
                    fontFamily === f
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-border text-muted hover:text-white hover:border-primary/50',
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
          <div className="mb-6">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-3">FONT SIZE</p>
            <div className="flex gap-3">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={cn(
                    'flex-1 border px-4 py-3 font-mono uppercase tracking-wider transition-all',
                    fontSize === s
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-border text-muted hover:text-white hover:border-primary/50',
                    s === 'sm' && 'text-xs',
                    s === 'md' && 'text-sm',
                    s === 'lg' && 'text-base'
                  )}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-3">ACCENT COLOR</p>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-12 h-12 border border-border cursor-pointer bg-background"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#e07c3a"
                className="font-mono text-sm bg-background border-border text-white w-32"
              />
              <div
                className="w-10 h-10 border border-border"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="card p-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="text-primary">04</span> QUICK ACTIONS
          </h2>

          <div className="flex gap-4">
            <a
              href="/newtab.html"
              className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-border text-muted hover:text-white hover:border-primary transition-colors"
            >
              → LIBRARY
            </a>
            <button
              onClick={() => {
                setApiKey('');
                setProvider('anthropic');
                setBaseUrl('');
                setModelId('claude-3-5-sonnet-20241022');
                setDefaultMode('FAST');
              }}
              className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-border text-muted hover:text-white hover:border-danger transition-colors"
            >
              RESET ALL
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}