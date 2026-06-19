import { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, getAppearance, saveAppearance } from '../../lib/storage';
import type { Settings, GenerationMode, LLMProvider, AppearanceSettings } from '../../lib/types';
import { SUPPORTED_MODELS } from '../../lib/types';
import { applyAppearance, watchAppearance } from '../../lib/theme';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ModelCombobox } from '@/components/ModelCombobox';
import { fetchAvailableModels, type ModelOption } from '@/lib/models-api';

const DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api/v1';
// BUG-002: a working free model so a new OpenRouter user can capture immediately
// without picking a model first.
// OpenRouter's own free auto-router — a real model id, used only as the zero-config
// default when no model is set. Explicit selections are never rewritten.
const OPENROUTER_DEFAULT_MODEL = 'openrouter/free';
const isOpenRouterUrl = (u: string) => /openrouter\.ai/i.test(u);
const normalizeModel = (model: string, url: string) =>
  !model.trim() && isOpenRouterUrl(url) ? OPENROUTER_DEFAULT_MODEL : model;

const PROVIDER_DEFS: Array<{ id: LLMProvider; label: string; description: string }> = [
  { id: 'anthropic', label: 'Anthropic', description: 'Claude API (api.anthropic.com)' },
  { id: 'openai-compatible', label: 'OpenRouter / Custom', description: 'OpenAI-compatible endpoints, any provider' },
  { id: 'offline', label: 'Offline NLP', description: 'No API calls, keyword-based local answers' },
];

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',  
  'openai-compatible': 'openai/gpt-4o-mini',
  offline: '',
};

export default function SettingsApp() {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<LLMProvider>('anthropic');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OPENROUTER_URL);
  const [modelId, setModelId] = useState(DEFAULT_MODELS.anthropic);
  const [defaultMode, setDefaultMode] = useState<GenerationMode>('FAST');

  const [theme, setTheme] = useState<AppearanceSettings['theme']>('dark');
  const [fontFamily, setFontFamily] = useState<AppearanceSettings['fontFamily']>('mono');
  const [fontSize, setFontSize] = useState<AppearanceSettings['fontSize']>('md');
  const [accentColor, setAccentColor] = useState('#0075de');

  const [localOnly, setLocalOnly] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Live model discovery for OpenAI-compatible endpoints.
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | undefined>(undefined);
  const [modelReloadKey, setModelReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([getSettings(), getAppearance()]).then(([s, a]) => {
      setApiKey(s.apiKey ?? '');
      setProvider(s.provider ?? 'anthropic');
      const loadedBaseUrl = s.baseUrl !== undefined ? s.baseUrl : (s.provider === 'openai-compatible' ? DEFAULT_OPENROUTER_URL : '');
      setBaseUrl(loadedBaseUrl);
      // Heal a stale/invalid stored model (e.g. the bogus "openrouter/free").
      setModelId(normalizeModel(s.modelId ?? DEFAULT_MODELS[s.provider || 'anthropic'], loadedBaseUrl));
      setDefaultMode(s.defaultMode ?? 'FAST');
      setLocalOnly(s.localOnly ?? false);
      setTheme(a.theme);
      setFontFamily(a.fontFamily);
      setFontSize(a.fontSize);
      setAccentColor(a.accentColor);
      applyAppearance(a);
    });
    // Live-sync if the theme is toggled on another page.
    return watchAppearance(a => {
      setTheme(a.theme);
      setFontFamily(a.fontFamily);
      setFontSize(a.fontSize);
      setAccentColor(a.accentColor);
      applyAppearance(a);
    });
  }, []);

  // Live preview the theme/accent as the user edits, before saving.
  useEffect(() => {
    applyAppearance({ theme, fontFamily, fontSize, accentColor });
  }, [theme, accentColor, fontFamily, fontSize]);

  // Live model discovery: when the OpenAI-compatible endpoint (and optionally key)
  // is set, pull the catalogue so the combobox can be searched. Debounced so typing
  // the key doesn't spam the API. Aborts in-flight requests on change.
  useEffect(() => {
    if (provider !== 'openai-compatible' || !baseUrl.trim()) {
      setModels([]); setModelsError(undefined); setModelsLoading(false);
      return;
    }
    const controller = new AbortController();
    setModelsLoading(true);
    setModelsError(undefined);
    const t = setTimeout(() => {
      fetchAvailableModels(baseUrl, apiKey, controller.signal)
        .then((list) => { setModels(list); setModelsLoading(false); })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setModels([]);
          setModelsError(err instanceof Error ? err.message : 'Failed to load models');
          setModelsLoading(false);
        });
    }, 500);
    return () => { controller.abort(); clearTimeout(t); };
  }, [provider, baseUrl, apiKey, modelReloadKey]);

  // Friction-free: persist the key/endpoint/model automatically (debounced) so the
  // user never has to hit Save before capturing. Skips the very first render.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    const t = setTimeout(() => { void handleSave(true); }, 800);
    return () => clearTimeout(t);
  }, [apiKey, baseUrl, modelId, provider, defaultMode, localOnly]);

  async function handleSave(silent = false) {
    // BUG-002: never save an OpenRouter endpoint with an empty model — fall back to
    // the free model so the first capture succeeds with no extra setup.
    const effectiveModel =
      provider === 'openai-compatible' ? normalizeModel(modelId, baseUrl) : modelId;
    if (effectiveModel !== modelId) setModelId(effectiveModel);
    const settings: Settings = {
      runtime: {
        chat: { providerId: '', modeModels: { FAST: effectiveModel || '', BALANCED: effectiveModel || '', DEEP: effectiveModel || '' } },
        embedding: { providerId: '', model: '', dimensions: 0, version: 1 },
      },
      defaults: { tags: [] },
      localOnly,
      apiKey,
      provider,
      baseUrl: baseUrl.trim() || '',
      modelId: effectiveModel,
      defaultMode,
    };
    const appearance: AppearanceSettings = {
      theme,
      fontFamily,
      fontSize,
      accentColor,
    };
    await Promise.all([saveSettings(settings), saveAppearance(appearance)]);
    if (!silent) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="bg-[var(--color-canvas-soft)] min-h-screen p-8 max-w-2xl mx-auto text-[var(--color-ink)]">
      <h1 className="text-[22px] font-bold tracking-tight mb-8">
        Notch Settings
      </h1>

      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">
          Privacy
        </h2>
        <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-[var(--color-ink)]">Local-only lock</p>
            <p className="text-[12px] text-[var(--color-ink-muted)] leading-relaxed mt-0.5">
              Guarantees nothing ever leaves this device. Capture and chat use the built-in
              offline NLP — no network calls, regardless of the provider configured below.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={localOnly}
            onClick={() => setLocalOnly(v => !v)}
            className={cn(
              'shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors relative',
              localOnly ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-hairline)]'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                localOnly && 'translate-x-4'
              )}
            />
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">
          Provider
        </h2>
        <div className="flex gap-3">
          {PROVIDER_DEFS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setProvider(item.id);
                setModelId(DEFAULT_MODELS[item.id]);
                if (item.id === 'openai-compatible') setBaseUrl(DEFAULT_OPENROUTER_URL);
                if (item.id === 'anthropic') setBaseUrl('');
              }}
              className={cn(
                'flex-1 bg-white rounded-xl border p-4 text-left transition-all hover:border-[var(--color-primary)]',
                provider === item.id ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]' : 'border-[var(--color-hairline)]'
              )}
            >
              <p className={cn(
                'text-[14px] font-semibold mb-1',
                provider === item.id ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink)]'
              )}>
                {item.label}
              </p>
              <p className="text-[12px] text-[var(--color-ink-muted)] leading-relaxed">
                {item.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {provider !== 'offline' && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">
            Endpoint
          </h2>
          <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5 flex flex-col gap-4">
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              {provider === 'anthropic'
                ? 'Leave empty for api.anthropic.com, or enter custom endpoint (e.g., http://localhost:8080)'
                : 'Select a preset or enter your OpenAI-compatible API endpoint URL'}
            </p>
            <div className="flex gap-2 flex-wrap">
              {provider === 'openai-compatible' && (
                <>
                  {[
                    { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
                    { label: 'MiniMax', url: 'https://api.minimax.chat/v1' },
                    { label: 'Localhost', url: 'http://localhost:8080/v1' },
                    { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
                    { label: 'Together', url: 'https://api.together.xyz/v1' },
                  ].map(({ label, url }) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => {
                        setBaseUrl(url);
                        // BUG-002: seed a working default for OpenRouter only when the
                        // user hasn't chosen a model yet — never overwrite a real choice.
                        if (isOpenRouterUrl(url) && (!modelId || modelId === DEFAULT_MODELS[provider])) {
                          setModelId(OPENROUTER_DEFAULT_MODEL);
                        }
                      }}
                      className={cn(
                        'text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all',
                        baseUrl === url
                          ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                          : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </>
              )}
            </div>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider === 'anthropic' ? 'https://api.anthropic.com (default)' : DEFAULT_OPENROUTER_URL}
              className="text-[13px]"
            />
            {baseUrl && (
              <p className="text-[11px] text-[var(--color-ink-faint)]">
                Active endpoint: {baseUrl.replace(/\/+$/, '')}/chat/completions
              </p>
            )}
            <hr className="border-t border-[var(--color-hairline)]" />
            <div>
              <p className="text-[11px] font-medium text-[var(--color-ink-muted)] mb-1">API Key (optional)</p>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="text-[13px] pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)]"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <hr className="border-t border-[var(--color-hairline)]" />
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-medium text-[var(--color-ink-muted)]">Model</p>
                {provider === 'openai-compatible' && (
                  <span className="text-[11px] text-[var(--color-ink-faint)]">
                    {modelsLoading ? 'Loading models…' : models.length ? `${models.length} available` : ''}
                  </span>
                )}
              </div>
              {provider === 'openai-compatible' ? (
                <ModelCombobox
                  value={modelId}
                  onChange={setModelId}
                  options={models}
                  loading={modelsLoading}
                  error={modelsError}
                  onRefresh={() => setModelReloadKey(k => k + 1)}
                  placeholder="Search or type a model id…"
                />
              ) : (
                <>
                  <select
                    value={SUPPORTED_MODELS.some(m => m.id === modelId) ? modelId : '__custom__'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '__custom__') setModelId(val);
                    }}
                    className="notion-input cursor-pointer w-full mb-2"
                  >
                    <option value="__custom__" disabled>{modelId || 'Custom model...'}</option>
                    <optgroup label="Anthropic (Direct)">
                      {SUPPORTED_MODELS.filter(m => m.id.startsWith('claude')).map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  <Input
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder="claude-sonnet-4-20250514, ..."
                    className="text-[13px]"
                  />
                </>
              )}
            </div>
          </div>
        </section>
      )}

      <Separator className="bg-[var(--color-hairline)] mb-8" />

      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">
          Appearance
        </h2>
        <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-6 flex flex-col gap-5">
          <div>
            <p className="text-[11px] font-medium text-[var(--color-ink-muted)] mb-2">Theme</p>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'flex-1 border rounded-md px-3 py-2 text-[12px] font-medium transition-all',
                    theme === t ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-[var(--color-ink-muted)] mb-2">Font Family</p>
            <div className="flex gap-2">
              {(['mono', 'serif', 'sans'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFontFamily(f)}
                  className={cn(
                    'flex-1 border rounded-md px-3 py-2 text-[12px] font-medium transition-all',
                    fontFamily === f ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                    f === 'mono' && 'font-mono',
                    f === 'serif' && 'font-serif',
                    f === 'sans' && ''
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-[var(--color-ink-muted)] mb-2">Font Size</p>
            <div className="flex gap-2">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={cn(
                    'flex-1 border rounded-md px-3 py-2 font-medium transition-all',
                    fontSize === s ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                    s === 'sm' && 'text-[11px]',
                    s === 'md' && 'text-[13px]',
                    s === 'lg' && 'text-[15px]'
                  )}
                >
                  {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-[var(--color-ink-muted)] mb-2">Accent Color</p>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-9 h-9 p-0.5 border border-[var(--color-hairline)] rounded-md cursor-pointer bg-transparent"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#0075de"
                className="text-[13px] w-28"
              />
              <span
                className="w-7 h-7 rounded-md border border-[var(--color-hairline)]"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>
        </div>
      </section>

      <button onClick={() => handleSave()} className="notion-btn-primary text-[14px] min-w-[160px]">
        {saved ? 'Saved' : 'Save Settings'}
      </button>
    </div>
  );
}
