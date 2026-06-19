import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import {
  getSettings, saveSettings, getAppearance, saveAppearance,
  getAllProviders, saveProvider, deleteProvider, getProvider,
} from '../../lib/storage';
import { PRESETS, testProviderConnection } from '../../lib/providers/registry';
import { applyAppearance, watchAppearance } from '../../lib/theme';
import type {
  Settings, ProviderConfig, ProviderProtocol,
  AppearanceSettings, GenerationMode, TestResult,
} from '../../lib/types';
import { cn } from '@/lib/utils';

type Tab = 'providers' | 'appearance';

function genId(): string {
  return crypto.randomUUID();
}

function emptyProvider(): ProviderConfig {
  return {
    id: genId(),
    label: '',
    protocol: 'openai',
    baseUrl: '',
    apiKey: '',
    extraHeaders: {},
    chatModel: '',
    embeddingModel: '',
    embeddingDimensions: 768,
    enabled: false,
  };
}

function ProviderForm({
  cfg, onChange, onTest, testResult, testing,
}: {
  cfg: ProviderConfig;
  onChange: (c: ProviderConfig) => void;
  onTest: () => void;
  testResult: TestResult | null;
  testing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">Label</label>
        <input
          value={cfg.label}
          onChange={(e) => onChange({ ...cfg, label: e.target.value })}
          className="notion-input"
          placeholder="My API Key"
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">Protocol</label>
        <select
          value={cfg.protocol}
          onChange={(e) => onChange({ ...cfg, protocol: e.target.value as ProviderProtocol })}
          className="notion-input cursor-pointer"
        >
          <option value="openai">OpenAI-compatible</option>
          <option value="anthropic">Anthropic (native)</option>
          <option value="gemini">Gemini (native)</option>
        </select>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">Base URL</label>
        <input
          value={cfg.baseUrl}
          onChange={(e) => onChange({ ...cfg, baseUrl: e.target.value })}
          className="notion-input"
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">API Key</label>
        <input
          type="password"
          value={cfg.apiKey}
          onChange={(e) => onChange({ ...cfg, apiKey: e.target.value })}
          className="notion-input"
          placeholder="sk-..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">Chat Model</label>
          <input
            value={cfg.chatModel}
            onChange={(e) => onChange({ ...cfg, chatModel: e.target.value })}
            className="notion-input"
            placeholder="gpt-4o-mini"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">Embedding Model</label>
          <input
            value={cfg.embeddingModel}
            onChange={(e) => onChange({ ...cfg, embeddingModel: e.target.value })}
            className="notion-input"
            placeholder="text-embedding-3-small"
          />
        </div>
      </div>

      <button
        onClick={onTest}
        disabled={testing}
        className={cn(
          'w-full py-2.5 text-[13px] font-medium rounded-full border transition-all',
          testing ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'notion-btn-utility w-full justify-center'
        )}
      >
        {testing ? 'Testing...' : 'Test Connection'}
      </button>

      {testResult && (
        <div className={cn('text-[12px] p-3 rounded-lg border', testResult.success ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-destructive)] text-[var(--color-destructive)] bg-[var(--color-destructive)]/5')}>
          {testResult.success
            ? `Connected (${testResult.latencyMs}ms)${testResult.model ? ` — ${testResult.model}` : ''}${testResult.dimensions ? `, ${testResult.dimensions}d embedding` : ''}`
            : `${testResult.error ?? 'Connection failed'}`}
        </div>
      )}
    </div>
  );
}

function PresetSelector({ onSelect }: { onSelect: (preset: typeof PRESETS[number]) => void }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">Quick Add Provider</p>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onSelect(p)}
            className="text-left text-[12px] font-medium border border-[var(--color-hairline)] rounded-lg px-3 py-2.5 text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  provider, active, onActivate, onEdit, onDelete,
}: {
  provider: ProviderConfig;
  active: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn('rounded-xl border p-4 space-y-2 bg-white transition-all', active ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]' : 'border-[var(--color-hairline)] hover:border-[var(--color-primary)]')}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[var(--color-ink)]">{provider.label || 'Unnamed'}</span>
        <span className="text-[11px] font-medium text-[var(--color-ink-muted)] bg-[var(--color-canvas-soft)] px-2 py-0.5 rounded-full">{provider.protocol}</span>
      </div>
      <p className="text-[12px] text-[var(--color-ink-muted)] truncate">{provider.baseUrl}</p>
      <p className="text-[11px] text-[var(--color-ink-faint)] truncate">Chat: {provider.chatModel || '\u2014'} / Embed: {provider.embeddingModel || '\u2014'}</p>
      <div className="flex gap-2 mt-2">
        {!active && (
          <button onClick={onActivate} className="notion-btn-primary text-[12px] py-1.5 px-4">Activate</button>
        )}
        {active && <span className="text-[12px] font-medium text-[var(--color-primary)] px-3 py-1.5 rounded-full bg-[var(--color-primary)]/5">Active</span>}
        <button onClick={onEdit} className="notion-btn-utility text-[12px]">Edit</button>
        <button onClick={onDelete} className="notion-btn-utility text-[12px] text-[var(--color-destructive)] border-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/5">Delete</button>
      </div>
    </div>
  );
}

export default function SettingsApp() {
  const [tab, setTab] = useState<Tab>('providers');
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [editing, setEditing] = useState<ProviderConfig | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  const [theme, setTheme] = useState<AppearanceSettings['theme']>('dark');
  const [fontFamily, setFontFamily] = useState<AppearanceSettings['fontFamily']>('mono');
  const [fontSize, setFontSize] = useState<AppearanceSettings['fontSize']>('md');
  const [accentColor, setAccentColor] = useState('#0075de');

  useEffect(() => {
    loadAll();
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

  async function loadAll() {
    const [provs, s, a] = await Promise.all([
      getAllProviders(),
      getSettings(),
      getAppearance(),
    ]);
    setProviders(provs);
    setSettingsState(s);
    setTheme(a.theme);
    setFontFamily(a.fontFamily);
    setFontSize(a.fontSize);
    setAccentColor(a.accentColor);
    applyAppearance(a);
  }

  async function handleSaveAppearance() {
    const app: AppearanceSettings = { theme, fontFamily, fontSize, accentColor };
    await saveAppearance(app);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleEditProvider(p: ProviderConfig) {
    setEditing({ ...p });
    setTestResult(null);
  }

  function handleNewProvider() {
    setEditing(emptyProvider());
    setTestResult(null);
  }

  function handlePresetSelect(preset: typeof PRESETS[number]) {
    setEditing({
      id: genId(),
      label: preset.label,
      protocol: preset.protocol,
      baseUrl: preset.baseUrl,
      apiKey: '',
      extraHeaders: {},
      chatModel: preset.chatModel,
      embeddingModel: preset.embeddingModel,
      embeddingDimensions: preset.embeddingDimensions,
      enabled: false,
    });
    setTestResult(null);
  }

  async function handleSaveProvider() {
    if (!editing) return;
    await saveProvider(editing);
    const provs = await getAllProviders();
    setProviders(provs);
    setEditing(null);
  }

  async function handleDeleteProvider(id: string) {
    await deleteProvider(id);
    const provs = await getAllProviders();
    setProviders(provs);
    if (editing?.id === id) setEditing(null);
  }

  async function handleActivate(providerId: string) {
    if (!settings) return;
    const p = await getProvider(providerId);
    if (!p) return;

    for (const prov of providers) {
      await saveProvider({ ...prov, enabled: prov.id === providerId });
    }

    const newSettings: Settings = {
      ...settings,
      runtime: {
        chat: {
          providerId,
          modeModels: {
            FAST: p.chatModel || settings.runtime.chat.modeModels.FAST,
            BALANCED: p.chatModel || settings.runtime.chat.modeModels.BALANCED,
            DEEP: p.chatModel || settings.runtime.chat.modeModels.DEEP,
          },
        },
        embedding: {
          providerId: p.embeddingModel ? providerId : settings.runtime.embedding.providerId,
          model: p.embeddingModel || settings.runtime.embedding.model,
          dimensions: p.embeddingDimensions || settings.runtime.embedding.dimensions,
          version: p.embeddingModel ? settings.runtime.embedding.version + 1 : settings.runtime.embedding.version,
        },
      },
      defaults: settings.defaults,
    };

    await saveSettings(newSettings);
    setSettingsState(newSettings);
    const provs = await getAllProviders();
    setProviders(provs);
  }

  async function handleTest() {
    if (!editing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProviderConnection(editing);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, latencyMs: 0, error: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  const activeProvider = providers.find(p => p.enabled);

  return (
    <div className="min-h-screen bg-[var(--color-canvas-soft)] text-[var(--color-ink)] p-8 max-w-3xl mx-auto">
      <h1 className="text-[26px] font-bold tracking-tight mb-8">Notch Settings</h1>

      <div className="flex gap-1 mb-8 bg-white rounded-lg border border-[var(--color-hairline)] p-1">
        <button
          onClick={() => setTab('providers')}
          className={cn(
            'flex-1 py-2 text-[13px] font-medium rounded-md transition-all',
            tab === 'providers' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
          )}
        >
          Providers
        </button>
        <button
          onClick={() => setTab('appearance')}
          className={cn(
            'flex-1 py-2 text-[13px] font-medium rounded-md transition-all',
            tab === 'appearance' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
          )}
        >
          Appearance
        </button>
      </div>

      {tab === 'providers' && (
        <div className="space-y-6">
          {activeProvider && (
            <div className="rounded-xl border border-[var(--color-primary)] bg-white p-5">
              <p className="text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-1">Active Provider</p>
              <p className="text-[16px] font-semibold text-[var(--color-ink)]">{activeProvider.label}</p>
              <p className="text-[12px] text-[var(--color-ink-muted)]">{activeProvider.baseUrl} &mdash; chat: {activeProvider.chatModel}</p>
            </div>
          )}

          {!activeProvider && (
            <div className="rounded-xl border border-[var(--color-destructive)] bg-white p-5">
              <p className="text-[13px] font-medium text-[var(--color-destructive)]">No active provider configured. Add one below.</p>
            </div>
          )}

          <div>
            <h2 className="text-[15px] font-semibold mb-3">Configured Providers</h2>
            {providers.length === 0 && (
              <p className="text-[13px] text-[var(--color-ink-muted)]">No providers configured yet.</p>
            )}
            <div className="space-y-3">
              {providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  active={p.enabled}
                  onActivate={() => handleActivate(p.id)}
                  onEdit={() => handleEditProvider(p)}
                  onDelete={() => handleDeleteProvider(p.id)}
                />
              ))}
            </div>
          </div>

          {editing && (
            <div className="rounded-xl border border-[var(--color-hairline)] bg-white p-6 space-y-5">
              <h2 className="text-[15px] font-semibold">
                {providers.find(p => p.id === editing.id) ? 'Edit Provider' : 'New Provider'}
              </h2>
              <ProviderForm
                cfg={editing}
                onChange={setEditing}
                onTest={handleTest}
                testResult={testResult}
                testing={testing}
              />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProvider}
                  className="notion-btn-primary flex-1 text-[14px]"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="notion-btn-utility flex-1 justify-center text-[14px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!editing && (
            <PresetSelector onSelect={handlePresetSelect} />
          )}

          {!editing && (
            <button
              onClick={handleNewProvider}
              className="w-full py-3 text-[13px] font-medium rounded-xl border-2 border-dashed border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all"
            >
              + Add Custom Provider
            </button>
          )}
        </div>
      )}

      {tab === 'appearance' && (
        <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-6 space-y-5">
          <div>
            <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">Theme</label>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'flex-1 py-2 text-[13px] font-medium rounded-md border transition-all',
                    theme === t ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">Font</label>
            <div className="flex gap-2">
              {(['mono', 'serif', 'sans'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFontFamily(f)}
                  className={cn(
                    'flex-1 py-2 text-[13px] font-medium rounded-md border transition-all',
                    fontFamily === f ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">Font Size</label>
            <div className="flex gap-2">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={cn(
                    'flex-1 py-2 font-medium rounded-md border transition-all',
                    fontSize === s ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                    s === 'sm' && 'text-[12px]', s === 'md' && 'text-[14px]', s === 'lg' && 'text-[16px]'
                  )}
                >
                  {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">Accent Color</label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-10 h-10 p-0.5 border border-[var(--color-hairline)] rounded-md cursor-pointer bg-transparent"
              />
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="notion-input w-28"
              />
              <span
                className="w-8 h-8 rounded-md border border-[var(--color-hairline)]"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>

          <button
            onClick={handleSaveAppearance}
            className="notion-btn-primary w-full text-[14px] mt-2"
          >
            {saved ? 'Saved' : 'Save Appearance'}
          </button>
        </div>
      )}
    </div>
  );
}
