import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import {
  getSettings, saveSettings, getAppearance, saveAppearance,
  getAllProviders, saveProvider, deleteProvider, getProvider,
} from '../../lib/storage';
import { PRESETS, testProviderConnection } from '../../lib/providers/registry';
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
    <div className="space-y-3">
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">Label</label>
        <input
          value={cfg.label}
          onChange={(e) => onChange({ ...cfg, label: e.target.value })}
          className="w-full font-mono text-xs bg-surface border border-border text-white p-2 outline-none focus:shadow-[0_0_0_1px_var(--color-primary),0_0_0_4px_rgb(199_161_90_/_16%)]"
          placeholder="My API Key"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">Protocol</label>
        <select
          value={cfg.protocol}
          onChange={(e) => onChange({ ...cfg, protocol: e.target.value as ProviderProtocol })}
          className="w-full font-mono text-xs bg-surface border border-border text-white p-2 outline-none"
        >
          <option value="openai">OpenAI-compatible</option>
          <option value="anthropic">Anthropic (native)</option>
          <option value="gemini">Gemini (native)</option>
        </select>
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">Base URL</label>
        <input
          value={cfg.baseUrl}
          onChange={(e) => onChange({ ...cfg, baseUrl: e.target.value })}
          className="w-full font-mono text-xs bg-surface border border-border text-white p-2 outline-none"
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">API Key</label>
        <input
          type="password"
          value={cfg.apiKey}
          onChange={(e) => onChange({ ...cfg, apiKey: e.target.value })}
          className="w-full font-mono text-xs bg-surface border border-border text-white p-2 outline-none"
          placeholder="sk-..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">Chat Model</label>
          <input
            value={cfg.chatModel}
            onChange={(e) => onChange({ ...cfg, chatModel: e.target.value })}
            className="w-full font-mono text-xs bg-surface border border-border text-white p-2 outline-none"
            placeholder="gpt-4o-mini"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">Embedding Model</label>
          <input
            value={cfg.embeddingModel}
            onChange={(e) => onChange({ ...cfg, embeddingModel: e.target.value })}
            className="w-full font-mono text-xs bg-surface border border-border text-white p-2 outline-none"
            placeholder="text-embedding-3-small"
          />
        </div>
      </div>

      <button
        onClick={onTest}
        disabled={testing}
        className={cn(
          'w-full py-2 font-mono text-xs uppercase tracking-wider border transition-colors',
          testing ? 'border-primary text-primary' : 'border-border text-white hover:bg-surface-hover',
        )}
      >
        {testing ? '[TESTING...]' : '[TEST CONNECTION]'}
      </button>

      {testResult && (
        <div className={cn('font-mono text-[10px] p-2 border', testResult.success ? 'border-primary text-primary' : 'border-danger text-danger')}>
          {testResult.success
            ? `✓ Connected (${testResult.latencyMs}ms)${testResult.model ? ` — ${testResult.model}` : ''}${testResult.dimensions ? `, ${testResult.dimensions}d embedding` : ''}`
            : `✗ ${testResult.error ?? 'Connection failed'}`}
        </div>
      )}
    </div>
  );
}

function PresetSelector({ onSelect }: { onSelect: (preset: typeof PRESETS[number]) => void }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">Quick Add Provider</p>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onSelect(p)}
            className="text-left font-mono text-[10px] uppercase tracking-wider border border-border p-2 text-white hover:bg-surface-hover transition-colors"
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
    <div className={cn('border p-3 space-y-1', active ? 'border-primary' : 'border-border')}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-white">{provider.label || 'Unnamed'}</span>
        <span className="font-mono text-[9px] uppercase text-muted">{provider.protocol}</span>
      </div>
      <p className="font-mono text-[9px] text-muted truncate">{provider.baseUrl}</p>
      <p className="font-mono text-[9px] text-muted truncate">Chat: {provider.chatModel || '—'} / Embed: {provider.embeddingModel || '—'}</p>
      <div className="flex gap-1.5 mt-1.5">
        {!active && (
          <button onClick={onActivate} className="font-mono text-[9px] uppercase tracking-wider border border-primary text-primary px-2 py-1 hover:bg-primary/10 transition-colors">[ACTIVATE]</button>
        )}
        {active && <span className="font-mono text-[9px] uppercase text-primary px-2 py-1 border border-primary">ACTIVE</span>}
        <button onClick={onEdit} className="font-mono text-[9px] uppercase tracking-wider border border-border text-white px-2 py-1 hover:bg-surface-hover transition-colors">[EDIT]</button>
        <button onClick={onDelete} className="font-mono text-[9px] uppercase tracking-wider border border-danger text-danger px-2 py-1 hover:bg-danger/10 transition-colors">[DELETE]</button>
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

  // Appearance state
  const [theme, setTheme] = useState<AppearanceSettings['theme']>('dark');
  const [fontFamily, setFontFamily] = useState<AppearanceSettings['fontFamily']>('mono');
  const [fontSize, setFontSize] = useState<AppearanceSettings['fontSize']>('md');
  const [accentColor, setAccentColor] = useState('#e07c3a');

  useEffect(() => {
    loadAll();
  }, []);

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

    // Disable all others, enable this one
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
    <div className="min-h-screen bg-background text-white p-6 max-w-2xl mx-auto">
      <h1 className="font-mono text-xl font-bold uppercase tracking-widest mb-6">NOTCH SETTINGS</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setTab('providers')}
          className={cn('font-mono text-xs uppercase tracking-wider px-4 py-2 border transition-colors', tab === 'providers' ? 'border-primary text-primary' : 'border-border text-white hover:bg-surface-hover')}
        >
          [PROVIDERS]
        </button>
        <button
          onClick={() => setTab('appearance')}
          className={cn('font-mono text-xs uppercase tracking-wider px-4 py-2 border transition-colors', tab === 'appearance' ? 'border-primary text-primary' : 'border-border text-white hover:bg-surface-hover')}
        >
          [APPEARANCE]
        </button>
      </div>

      {tab === 'providers' && (
        <div className="space-y-6">
          {/* Active provider */}
          {activeProvider && (
            <div className="border border-primary p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">Active Provider</p>
              <p className="font-mono text-xs text-white">{activeProvider.label}</p>
              <p className="font-mono text-[9px] text-muted">{activeProvider.baseUrl} — chat: {activeProvider.chatModel}</p>
            </div>
          )}

          {!activeProvider && (
            <div className="border border-danger p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-danger">No active provider configured. Add one below.</p>
            </div>
          )}

          {/* Provider list */}
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-widest text-white">Configured Providers</p>
            {providers.length === 0 && (
              <p className="font-mono text-[10px] text-muted">No providers configured yet.</p>
            )}
            <div className="space-y-2">
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

          {/* Editing form */}
          {editing && (
            <div className="border border-border p-4 space-y-4">
              <p className="font-mono text-xs uppercase tracking-widest text-white">
                {providers.find(p => p.id === editing.id) ? 'EDIT PROVIDER' : 'NEW PROVIDER'}
              </p>
              <ProviderForm
                cfg={editing}
                onChange={setEditing}
                onTest={handleTest}
                testResult={testResult}
                testing={testing}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProvider}
                  className="flex-1 py-2 font-mono text-xs uppercase tracking-wider border border-primary text-primary hover:bg-primary/10 transition-colors"
                >
                  [SAVE]
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 py-2 font-mono text-xs uppercase tracking-wider border border-border text-white hover:bg-surface-hover transition-colors"
                >
                  [CANCEL]
                </button>
              </div>
            </div>
          )}

          {/* Presets */}
          {!editing && (
            <PresetSelector onSelect={handlePresetSelect} />
          )}

          {/* Add new button */}
          {!editing && (
            <button
              onClick={handleNewProvider}
              className="w-full py-3 font-mono text-xs uppercase tracking-wider border-2 border-dashed border-border text-muted hover:text-white hover:border-primary transition-colors"
            >
              [+ ADD CUSTOM PROVIDER]
            </button>
          )}
        </div>
      )}

      {tab === 'appearance' && (
        <div className="space-y-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">Theme</label>
            <div className="flex gap-1.5">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn('flex-1 py-2 font-mono text-xs uppercase tracking-wider border transition-colors', theme === t ? 'border-primary text-primary' : 'border-border text-white hover:bg-surface-hover')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">Font</label>
            <div className="flex gap-1.5">
              {(['mono', 'serif', 'sans'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFontFamily(f)}
                  className={cn('flex-1 py-2 font-mono text-xs uppercase tracking-wider border transition-colors', fontFamily === f ? 'border-primary text-primary' : 'border-border text-white hover:bg-surface-hover')}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">Accent Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-10 h-10 p-0 border border-border bg-transparent cursor-pointer"
              />
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 font-mono text-xs bg-surface border border-border text-white p-2 outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleSaveAppearance}
            className="w-full py-3 font-mono text-xs uppercase tracking-wider border border-primary text-primary hover:bg-primary/10 transition-colors"
          >
            {saved ? '[SAVED]' : '[SAVE APPEARANCE]'}
          </button>
        </div>
      )}
    </div>
  );
}
