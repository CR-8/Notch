import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import {
  getSettings,
  saveSettings,
  getAppearance,
  saveAppearance,
  getAllProviders,
  saveProvider,
  deleteProvider,
  getProvider,
  clearAllApiKeys,
} from '../../lib/storage';
import { PRESETS, testProviderConnection } from '../../lib/providers/registry';
import { applyAppearance, watchAppearance } from '../../lib/theme';
import { goToLibrary } from '../../lib/navigation';
import type {
  Settings,
  ProviderConfig,
  ProviderProtocol,
  AppearanceSettings,
  GenerationMode,
  TestResult,
} from '../../lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ModelCombobox } from '@/components/ModelCombobox';
import { fetchAvailableModels, type ModelOption } from '@/lib/models-api';
import { detectLocalServers, type LocalServerResult } from '@/lib/local-servers';
import { LOCAL_MODELS, getOnDeviceConfig, type ModelStatus } from '@/lib/on-device';
import { log } from '@/lib/logger';

type Tab = 'providers' | 'general' | 'on-device' | 'appearance';

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
  cfg,
  onChange,
  onTest,
  testResult,
  testing,
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
        <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">
          Label
        </label>
        <input
          value={cfg.label}
          onChange={(e) => onChange({ ...cfg, label: e.target.value })}
          className="notion-input"
          placeholder="My API Key"
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">
          Protocol
        </label>
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
        <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">
          Base URL
        </label>
        <input
          value={cfg.baseUrl}
          onChange={(e) => onChange({ ...cfg, baseUrl: e.target.value })}
          className="notion-input"
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">
          API Key
        </label>
        <input
          type="password"
          value={cfg.apiKey}
          onChange={(e) => onChange({ ...cfg, apiKey: e.target.value })}
          className="notion-input"
          placeholder="sk-..."
        />
        <p className="text-[11px] text-[var(--color-ink-muted)] leading-relaxed mt-1.5">
          Stored only on this device in the browser's local database. It is sent solely to the
          provider endpoint above when you capture or chat — never to Notch. Remove it anytime with
          Delete, or clear every key at the bottom of this page.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">
            Chat Model
          </label>
          <input
            value={cfg.chatModel}
            onChange={(e) => onChange({ ...cfg, chatModel: e.target.value })}
            className="notion-input"
            placeholder="gpt-4o-mini"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-1">
            Embedding Model
          </label>
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
          testing
            ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
            : 'notion-btn-utility w-full justify-center',
        )}
      >
        {testing ? 'Testing...' : 'Test Connection'}
      </button>

      {testResult && (
        <div
          className={cn(
            'text-[12px] p-3 rounded-lg border',
            testResult.success
              ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
              : 'border-[var(--color-destructive)] text-[var(--color-destructive)] bg-[var(--color-destructive)]/5',
          )}
        >
          {testResult.success
            ? `Connected (${testResult.latencyMs}ms)${testResult.model ? ` — ${testResult.model}` : ''}${testResult.dimensions ? `, ${testResult.dimensions}d embedding` : ''}`
            : `${testResult.error ?? 'Connection failed'}`}
        </div>
      )}
    </div>
  );
}

function PresetSelector({ onSelect }: { onSelect: (preset: (typeof PRESETS)[number]) => void }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
        Quick Add Provider
      </p>
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
  provider,
  active,
  onActivate,
  onEdit,
  onDelete,
}: {
  provider: ProviderConfig;
  active: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-2 bg-white transition-all',
        active
          ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
          : 'border-[var(--color-hairline)] hover:border-[var(--color-primary)]',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[var(--color-ink)]">
          {provider.label || 'Unnamed'}
        </span>
        <span className="text-[11px] font-medium text-[var(--color-ink-muted)] bg-[var(--color-canvas-soft)] px-2 py-0.5 rounded-full">
          {provider.protocol}
        </span>
      </div>
      <p className="text-[12px] text-[var(--color-ink-muted)] truncate">{provider.baseUrl}</p>
      <p className="text-[11px] text-[var(--color-ink-faint)] truncate">
        Chat: {provider.chatModel || '\u2014'} / Embed: {provider.embeddingModel || '\u2014'}
      </p>
      <div className="flex gap-2 mt-2">
        {!active && (
          <button onClick={onActivate} className="notion-btn-primary text-[12px] py-1.5 px-4">
            Activate
          </button>
        )}
        {active && (
          <span className="text-[12px] font-medium text-[var(--color-primary)] px-3 py-1.5 rounded-full bg-[var(--color-primary)]/5">
            Active
          </span>
        )}
        <button onClick={onEdit} className="notion-btn-utility text-[12px]">
          Edit
        </button>
        <button
          onClick={onDelete}
          className="notion-btn-utility text-[12px] text-[var(--color-destructive)] border-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/5"
        >
          Delete
        </button>
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
  const [accentColor, setAccentColor] = useState('#111111');

  const [localOnly, setLocalOnly] = useState(false);
  const [allowRemotePlantUml, setAllowRemotePlantUml] = useState(false);
  const [defaultMode, setDefaultMode] = useState<GenerationMode>('FAST');
  const [clearKeysConfirm, setClearKeysConfirm] = useState(false);
  const [clearKeysNotice, setClearKeysNotice] = useState<string | null>(null);

  const [fastModel, setFastModel] = useState('');
  const [balancedModel, setBalancedModel] = useState('');
  const [deepModel, setDeepModel] = useState('');

  const [embeddingModel, setEmbeddingModel] = useState('');
  const [embeddingDimensions, setEmbeddingDimensions] = useState(0);

  const [reEmbedStatus, setReEmbedStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [reEmbedProgress, setReEmbedProgress] = useState({ done: 0, total: 0 });

  const [onDeviceModelStatuses, setOnDeviceModelStatuses] = useState<Record<string, ModelStatus>>(
    {},
  );
  const [onDeviceProgress, setOnDeviceProgress] = useState<Record<string, number>>({});
  const [onDeviceEmbedId, setOnDeviceEmbedId] = useState<string | null>(null);
  const [onDeviceChatId, setOnDeviceChatId] = useState<string | null>(null);
  const [onDeviceEnabled, setOnDeviceEnabled] = useState(false);
  const [gpuAvailable, setGpuAvailable] = useState(false);

  const [logEntries, setLogEntries] = useState<ReturnType<typeof log.getBuffer>>([]);
  const [showLog, setShowLog] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'success'>('all');

  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | undefined>(undefined);
  const [modelReloadKey, setModelReloadKey] = useState(0);

  const [detectingServers, setDetectingServers] = useState(false);
  const [detectedServers, setDetectedServers] = useState<LocalServerResult[]>([]);
  const [serverDetectError, setServerDetectError] = useState<string | undefined>();

  async function loadAll() {
    const [provs, s, a, od] = await Promise.all([
      getAllProviders(),
      getSettings(),
      getAppearance(),
      getOnDeviceConfig(),
    ]);
    setProviders(provs);
    setSettingsState(s);
    setTheme(a.theme);
    setFontFamily(a.fontFamily);
    setFontSize(a.fontSize);
    setAccentColor(a.accentColor);
    setLocalOnly(s.localOnly ?? false);
    setAllowRemotePlantUml(s.allowRemotePlantUml ?? false);
    setDefaultMode(s.defaultMode ?? 'FAST');
    applyAppearance(a);

    const mm = s.runtime?.chat?.modeModels;
    if (mm) {
      setFastModel(mm.FAST || '');
      setBalancedModel(mm.BALANCED || '');
      setDeepModel(mm.DEEP || '');
    }
    const emb = s.runtime?.embedding;
    if (emb) {
      setEmbeddingModel(emb.model || '');
      setEmbeddingDimensions(emb.dimensions || 0);
    }

    setOnDeviceModelStatuses(od.status);
    setOnDeviceProgress(od.progress);
    setOnDeviceEmbedId(od.embeddingModelId);
    setOnDeviceChatId(od.chatModelId);
    setOnDeviceEnabled(od.enabled);
  }

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadAll();
    })();
    return watchAppearance((a) => {
      setTheme(a.theme);
      setFontFamily(a.fontFamily);
      setFontSize(a.fontSize);
      setAccentColor(a.accentColor);
      applyAppearance(a);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        if ('gpu' in navigator) {
          const adapter = await (
            navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }
          ).gpu?.requestAdapter();
          setGpuAvailable(adapter != null);
        }
      } catch {
        setGpuAvailable(false);
      }
    })();
  }, []);

  useEffect(() => {
    function onMsg(msg: unknown) {
      const m = msg as { type?: string; payload?: Record<string, number | string> };
      const payload = m?.payload;
      if (!payload) return;
      if (m?.type === 'MODEL_DOWNLOAD_PROGRESS') {
        setOnDeviceProgress((prev) => ({
          ...prev,
          [String(payload.modelId ?? '')]: Number(payload.pct ?? 0),
        }));
        setOnDeviceModelStatuses((prev) => ({
          ...prev,
          [String(payload.modelId ?? '')]: 'downloading',
        }));
      } else if (m?.type === 'MODEL_DOWNLOAD_COMPLETE') {
        setOnDeviceModelStatuses((prev) => ({ ...prev, [String(payload.modelId ?? '')]: 'ready' }));
        setOnDeviceProgress((prev) => ({ ...prev, [String(payload.modelId ?? '')]: 100 }));
      } else if (m?.type === 'MODEL_DOWNLOAD_ERROR') {
        setOnDeviceModelStatuses((prev) => ({ ...prev, [String(payload.modelId ?? '')]: 'error' }));
      } else if (m?.type === 'RE_EMBED_PROGRESS') {
        setReEmbedProgress({ done: Number(payload.done ?? 0), total: Number(payload.total ?? 0) });
      }
    }
    browser.runtime.onMessage.addListener(onMsg);
    return () => browser.runtime.onMessage.removeListener(onMsg);
  }, []);

  useEffect(() => {
    applyAppearance({ theme, fontFamily, fontSize, accentColor });
  }, [theme, accentColor, fontFamily, fontSize]);

  useEffect(() => {
    const activeProvider = providers.find((p) => p.enabled);
    const baseUrl = activeProvider?.baseUrl ?? '';
    const apiKey = activeProvider?.apiKey ?? '';
    if (!baseUrl.trim()) {
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      setModelsLoading(true);
      setModelsError(undefined);
      fetchAvailableModels(baseUrl, apiKey, controller.signal)
        .then((list) => {
          setModels(list);
          setModelsLoading(false);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setModels([]);
          setModelsError(err instanceof Error ? err.message : 'Failed to load models');
          setModelsLoading(false);
        });
    }, 500);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [providers, modelReloadKey]);

  async function handleSave() {
    if (!settings) return;
    const sm = fastModel || balancedModel || deepModel || '';
    const newSettings: Settings = {
      ...settings,
      runtime: {
        chat: {
          providerId: settings.runtime.chat.providerId,
          modeModels: {
            FAST: fastModel || sm,
            BALANCED: balancedModel || sm,
            DEEP: deepModel || sm,
          },
        },
        embedding: {
          providerId: settings.runtime.embedding.providerId,
          model: embeddingModel || settings.runtime.embedding.model,
          dimensions: embeddingDimensions || settings.runtime.embedding.dimensions,
          version: settings.runtime.embedding.version,
        },
      },
      defaults: settings.defaults,
      localOnly,
      allowRemotePlantUml,
      defaultMode,
    };
    const app: AppearanceSettings = { theme, fontFamily, fontSize, accentColor };
    await Promise.all([saveSettings(newSettings), saveAppearance(app)]);
    setSettingsState(newSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDetectServers() {
    setDetectingServers(true);
    setDetectedServers([]);
    setServerDetectError(undefined);
    try {
      const results = await detectLocalServers();
      setDetectedServers(results.filter((r) => r.online));
      if (results.every((r) => !r.online))
        setServerDetectError('No local AI servers found on the default ports.');
    } catch (err) {
      setServerDetectError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setDetectingServers(false);
    }
  }

  function handleEditProvider(p: ProviderConfig) {
    setEditing({ ...p });
    setTestResult(null);
  }

  function handleNewProvider() {
    setEditing(emptyProvider());
    setTestResult(null);
  }

  function handlePresetSelect(preset: (typeof PRESETS)[number]) {
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

  async function handleClearAllKeys() {
    const count = await clearAllApiKeys();
    const provs = await getAllProviders();
    setProviders(provs);
    if (editing) setEditing({ ...editing, apiKey: '' });
    const s = await getSettings();
    setSettingsState(s);
    setClearKeysConfirm(false);
    setClearKeysNotice(
      count === 0
        ? 'No stored keys to clear.'
        : `Cleared ${count} stored API key${count === 1 ? '' : 's'}.`,
    );
    setTimeout(() => setClearKeysNotice(null), 4000);
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
          version: p.embeddingModel
            ? settings.runtime.embedding.version + 1
            : settings.runtime.embedding.version,
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

  async function handleReEmbed() {
    if (!embeddingModel) return;
    setReEmbedStatus('running');
    setReEmbedProgress({ done: 0, total: 0 });
    try {
      await handleSave();
      await browser.runtime.sendMessage({
        type: 'RE_EMBED_ALL',
        payload: { providerId: '', model: embeddingModel },
      });
      setReEmbedStatus('done');
    } catch {
      setReEmbedStatus('error');
    }
  }

  function installOnDeviceModel(modelId: string) {
    setOnDeviceModelStatuses((prev) => ({ ...prev, [modelId]: 'downloading' }));
    setOnDeviceProgress((prev) => ({ ...prev, [modelId]: 0 }));
    browser.runtime
      .sendMessage({ type: 'MODEL_DOWNLOAD_START', payload: { modelId } })
      .catch(() => {});
  }

  async function handleSetOnDeviceEmbedding(modelId: string) {
    setOnDeviceEmbedId(modelId);
    await browser.runtime
      .sendMessage({ type: 'MODEL_SET_EMBEDDING', payload: { modelId } })
      .catch(() => {});
  }

  async function handleSetOnDeviceChat(modelId: string) {
    setOnDeviceChatId(modelId);
    await browser.runtime
      .sendMessage({ type: 'MODEL_SET_CHAT', payload: { modelId } })
      .catch(() => {});
  }

  async function handleToggleOnDevice(enabled: boolean) {
    setOnDeviceEnabled(enabled);
    await browser.runtime
      .sendMessage({ type: 'MODEL_ENABLE_ON_DEVICE', payload: { enabled } })
      .catch(() => {});
  }

  const activeProvider = providers.find((p) => p.enabled);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'providers', label: 'Providers' },
    { id: 'general', label: 'General' },
    { id: 'on-device', label: 'On-Device' },
    { id: 'appearance', label: 'Appearance' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-canvas-soft)] text-[var(--color-ink)]">
      <header className="sticky top-0 z-10 bg-[var(--color-canvas)] border-b border-[var(--color-hairline)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-8 h-14">
          <button
            onClick={goToLibrary}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            <span aria-hidden="true" className="text-[16px] leading-none">
              &larr;
            </span>
            Library
          </button>
          <span className="text-[13px] font-semibold tracking-tight">Notch</span>
          <div className="w-16" />
        </div>
      </header>

      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-[26px] font-bold tracking-tight mb-8">Settings</h1>

        <div className="flex gap-1 mb-8 bg-white rounded-lg border border-[var(--color-hairline)] p-1">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 py-2 text-[13px] font-medium rounded-md transition-all',
                tab === id
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── PROVIDERS TAB ─────────────────────────────────────────────── */}
        {tab === 'providers' && (
          <div className="space-y-6">
            {activeProvider && (
              <div className="rounded-xl border border-[var(--color-primary)] bg-white p-5">
                <p className="text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-1">
                  Active Provider
                </p>
                <p className="text-[16px] font-semibold text-[var(--color-ink)]">
                  {activeProvider.label}
                </p>
                <p className="text-[12px] text-[var(--color-ink-muted)]">
                  {activeProvider.baseUrl} &mdash; chat: {activeProvider.chatModel}
                </p>
              </div>
            )}

            {!activeProvider && (
              <div className="rounded-xl border border-[var(--color-destructive)] bg-white p-5">
                <p className="text-[13px] font-medium text-[var(--color-destructive)]">
                  No active provider configured. Add one below.
                </p>
              </div>
            )}

            <div>
              <h2 className="text-[15px] font-semibold mb-3">Configured Providers</h2>
              {providers.length === 0 && (
                <p className="text-[13px] text-[var(--color-ink-muted)]">
                  No providers configured yet.
                </p>
              )}
              <div className="space-y-3">
                {providers.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    active={p.enabled}
                    onActivate={() => {
                      handleActivate(p.id).catch(() => {});
                    }}
                    onEdit={() => {
                      handleEditProvider(p);
                    }}
                    onDelete={() => {
                      handleDeleteProvider(p.id).catch(() => {});
                    }}
                  />
                ))}
              </div>
            </div>

            {editing && (
              <div className="rounded-xl border border-[var(--color-hairline)] bg-white p-6 space-y-5">
                <h2 className="text-[15px] font-semibold">
                  {providers.find((p) => p.id === editing.id) ? 'Edit Provider' : 'New Provider'}
                </h2>
                <ProviderForm
                  cfg={editing}
                  onChange={setEditing}
                  onTest={() => {
                    handleTest().catch(() => {});
                  }}
                  testResult={testResult}
                  testing={testing}
                />
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      handleSaveProvider().catch(() => {});
                    }}
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

            {!editing && <PresetSelector onSelect={handlePresetSelect} />}

            {!editing && (
              <button
                onClick={() => {
                  handleNewProvider();
                }}
                className="w-full py-3 text-[13px] font-medium rounded-xl border-2 border-dashed border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all"
              >
                + Add Custom Provider
              </button>
            )}

            {/* Key storage disclosure + clear-all control */}
            <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] p-5">
              <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
                Where your keys live
              </p>
              <p className="text-[12px] text-[var(--color-ink-muted)] leading-relaxed">
                Notch is bring-your-own-key. API keys are stored unencrypted in this browser's local
                database (IndexedDB) on your device. They are sent only to the provider endpoints
                you configure above — never to any Notch server. Anyone with access to this browser
                profile can read them, so clear your keys before sharing or disposing of this
                device.
              </p>
              {clearKeysNotice && (
                <p className="text-[12px] font-medium text-[var(--color-primary)] mt-3">
                  {clearKeysNotice}
                </p>
              )}
              {!clearKeysConfirm ? (
                <button
                  onClick={() => setClearKeysConfirm(true)}
                  className="mt-3 notion-btn-utility text-[12px] text-[var(--color-destructive)] border-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/5"
                >
                  Clear all API keys
                </button>
              ) : (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-[12px] text-[var(--color-ink)]">
                    Clear every stored key? Provider settings stay; only the secrets are removed.
                  </span>
                  <button
                    onClick={() => {
                      handleClearAllKeys().catch(() => {});
                    }}
                    className="notion-btn-utility text-[12px] text-[var(--color-destructive)] border-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/5"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setClearKeysConfirm(false)}
                    className="notion-btn-utility text-[12px]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GENERAL TAB ───────────────────────────────────────────────── */}
        {tab === 'general' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-[var(--color-ink)]">Local-only lock</p>
                <p className="text-[12px] text-[var(--color-ink-muted)] leading-relaxed mt-0.5">
                  Guarantees nothing ever leaves this device. Capture and chat use the built-in
                  offline NLP — no network calls, regardless of the provider configured.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={localOnly}
                onClick={() => setLocalOnly((v) => !v)}
                className={cn(
                  'shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors relative',
                  localOnly ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-hairline)]',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                    localOnly && 'translate-x-4',
                  )}
                />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                  Remote PlantUML diagrams
                </p>
                <p className="text-[12px] text-[var(--color-ink-muted)] leading-relaxed mt-0.5">
                  PlantUML diagrams can only be rendered by sending their source text to the public
                  plantuml.com service. Off by default to keep content on-device; turn this on to
                  render them. Ignored while the local-only lock is enabled.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={allowRemotePlantUml}
                disabled={localOnly}
                onClick={() => setAllowRemotePlantUml((v) => !v)}
                className={cn(
                  'shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors relative',
                  localOnly && 'opacity-40 cursor-not-allowed',
                  allowRemotePlantUml && !localOnly
                    ? 'bg-[var(--color-primary)]'
                    : 'bg-[var(--color-hairline)]',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                    allowRemotePlantUml && !localOnly && 'translate-x-4',
                  )}
                />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5">
              <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">
                Default Capture Mode
              </p>
              <div className="flex gap-3">
                {(['FAST', 'BALANCED', 'DEEP'] as GenerationMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDefaultMode(m)}
                    className={cn(
                      'flex-1 rounded-lg border p-3 text-left transition-all hover:border-[var(--color-primary)]',
                      defaultMode === m
                        ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                        : 'border-[var(--color-hairline)]',
                    )}
                  >
                    <p
                      className={cn(
                        'text-[13px] font-semibold',
                        defaultMode === m
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-ink)]',
                      )}
                    >
                      {m.charAt(0) + m.slice(1).toLowerCase()}
                    </p>
                    <p className="text-[11px] text-[var(--color-ink-muted)] mt-0.5">
                      {m === 'FAST'
                        ? 'Quick, lower cost'
                        : m === 'BALANCED'
                          ? 'Quality + speed'
                          : 'Best, higher cost'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {activeProvider && (
              <>
                <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5 space-y-4">
                  <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide">
                    Per-Mode Model Override
                  </p>
                  <p className="text-[12px] text-[var(--color-ink-muted)]">
                    Assign different models per capture mode. Leave blank to use the active
                    provider's default.
                  </p>
                  {(['FAST', 'BALANCED', 'DEEP'] as const).map((mode) => {
                    const val =
                      mode === 'FAST' ? fastModel : mode === 'BALANCED' ? balancedModel : deepModel;
                    const setter =
                      mode === 'FAST'
                        ? setFastModel
                        : mode === 'BALANCED'
                          ? setBalancedModel
                          : setDeepModel;
                    return (
                      <div key={mode}>
                        <p className="text-[11px] font-medium text-[var(--color-ink-muted)] mb-1">
                          {mode.charAt(0) + mode.slice(1).toLowerCase()}
                        </p>
                        <Input
                          value={val}
                          onChange={(e) => setter(e.target.value)}
                          placeholder={`Model ID for ${mode.toLowerCase()} mode`}
                          className="text-[13px]"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5 space-y-4">
                  <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide">
                    Embedding Model
                  </p>
                  <p className="text-[12px] text-[var(--color-ink-muted)]">
                    Used for semantic search. Must match the model that generated your existing
                    vectors. Changing this requires re-embedding all documents.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-[11px] font-medium text-[var(--color-ink-muted)] mb-1">
                        Model
                      </p>
                      <Input
                        value={embeddingModel}
                        onChange={(e) => setEmbeddingModel(e.target.value)}
                        placeholder="text-embedding-3-small"
                        className="text-[13px]"
                      />
                    </div>
                    <div className="w-24">
                      <p className="text-[11px] font-medium text-[var(--color-ink-muted)] mb-1">
                        Dimensions
                      </p>
                      <Input
                        type="number"
                        value={embeddingDimensions || ''}
                        onChange={(e) => setEmbeddingDimensions(Number(e.target.value))}
                        placeholder="768"
                        className="text-[13px]"
                      />
                    </div>
                    <div className="pt-5">
                      <button
                        onClick={() => {
                          handleReEmbed().catch(() => {});
                        }}
                        disabled={reEmbedStatus === 'running' || !embeddingModel}
                        className={cn(
                          'text-[11px] font-medium px-3 py-2 rounded-lg border transition-all whitespace-nowrap',
                          reEmbedStatus === 'running'
                            ? 'border-[var(--color-hairline)] text-[var(--color-ink-faint)] cursor-not-allowed'
                            : 'border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5',
                        )}
                      >
                        {reEmbedStatus === 'running'
                          ? `Re-embedding… ${reEmbedProgress.done}/${reEmbedProgress.total}`
                          : reEmbedStatus === 'done'
                            ? '✓ Done'
                            : reEmbedStatus === 'error'
                              ? 'Error — retry'
                              : 'Re-embed all'}
                      </button>
                    </div>
                  </div>
                  {reEmbedStatus === 'running' && reEmbedProgress.total > 0 && (
                    <div className="h-1.5 bg-[var(--color-canvas-soft)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.round((reEmbedProgress.done / reEmbedProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide">
                      Endpoint &amp; Model Discovery
                    </p>
                    <button
                      onClick={() => {
                        handleDetectServers().catch(() => {});
                      }}
                      disabled={detectingServers}
                      className={cn(
                        'text-[11px] font-medium px-3 py-1 rounded-full border transition-all',
                        detectingServers
                          ? 'border-[var(--color-hairline)] text-[var(--color-ink-faint)] cursor-not-allowed'
                          : 'border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5',
                      )}
                    >
                      {detectingServers ? 'Scanning…' : 'Detect local servers'}
                    </button>
                  </div>
                  <p className="text-[12px] text-[var(--color-ink-muted)]">
                    {activeProvider.baseUrl}
                  </p>
                  <div className="flex items-center gap-2">
                    <ModelCombobox
                      value={activeProvider.chatModel}
                      onChange={() => {}}
                      options={models}
                      loading={modelsLoading}
                      error={modelsError}
                      onRefresh={() => setModelReloadKey((k) => k + 1)}
                      placeholder="Search available models…"
                    />
                  </div>
                  {serverDetectError && (
                    <p className="text-[11px] text-[var(--color-ink-faint)]">{serverDetectError}</p>
                  )}
                  {detectedServers.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {detectedServers.map((srv) => (
                        <div
                          key={srv.baseUrl}
                          className="flex items-center justify-between gap-3 bg-[var(--color-canvas-soft)] rounded-lg p-3 border border-[var(--color-hairline)]"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                              {srv.label}
                            </p>
                            <p className="text-[11px] text-[var(--color-ink-muted)] truncate">
                              {srv.baseUrl}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              onClick={() => {
                handleSave().catch(() => {});
              }}
              className="notion-btn-primary text-[14px] min-w-[160px]"
            >
              {saved ? 'Saved ✓' : 'Save Settings'}
            </button>
          </div>
        )}

        {/* ── ON-DEVICE TAB ─────────────────────────────────────────────── */}
        {tab === 'on-device' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[14px] font-semibold text-[var(--color-ink)]">On-Device AI</p>
                  <p className="text-[12px] text-[var(--color-ink-muted)] mt-0.5">
                    Run embeddings and chat locally in your browser — no API key needed, full
                    privacy.
                    {gpuAvailable
                      ? ' ✓ WebGPU detected — large models available.'
                      : ' WebGPU not detected — only WASM models available.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={onDeviceEnabled}
                  onClick={() => {
                    handleToggleOnDevice(!onDeviceEnabled).catch(() => {});
                  }}
                  className={cn(
                    'shrink-0 w-10 h-6 rounded-full transition-colors relative',
                    onDeviceEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-hairline)]',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                      onDeviceEnabled && 'translate-x-4',
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {LOCAL_MODELS.map((m) => {
                const status = onDeviceModelStatuses[m.id] ?? 'not-installed';
                const pct = onDeviceProgress[m.id] ?? 0;
                const isReady = status === 'ready';
                const isDownloading = status === 'downloading';
                const isUnavailable = m.backend === 'webgpu' && !gpuAvailable;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'bg-white rounded-xl border p-4 flex flex-col gap-2 transition-all',
                      isUnavailable
                        ? 'opacity-50 border-[var(--color-hairline)]'
                        : 'border-[var(--color-hairline)]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                            {m.label}
                          </span>
                          <span
                            className={cn(
                              'text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                              m.backend === 'webgpu'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-green-100 text-green-700',
                            )}
                          >
                            {m.backend === 'webgpu' ? 'WebGPU' : 'WASM'}
                          </span>
                          <span className="text-[10px] text-[var(--color-ink-faint)]">
                            {m.sizeLabel}
                          </span>
                          {isReady && (
                            <span className="text-[10px] text-green-600 font-medium">
                              ✓ Installed
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-muted)] leading-snug">
                          {m.description}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isReady ? null : isDownloading ? (
                          <span className="text-[11px] text-[var(--color-primary)]">{pct}%</span>
                        ) : (
                          <button
                            onClick={() => {
                              installOnDeviceModel(m.id);
                            }}
                            disabled={isUnavailable}
                            className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-active)] transition-colors disabled:opacity-40"
                          >
                            Install
                          </button>
                        )}
                      </div>
                    </div>
                    {isDownloading && (
                      <div className="h-1 bg-[var(--color-canvas-soft)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {isReady && (
                      <div className="flex gap-2 flex-wrap">
                        {(m.capability === 'embedding' || m.capability === 'both') && (
                          <button
                            onClick={() => {
                              handleSetOnDeviceEmbedding(m.id).catch(() => {});
                            }}
                            className={cn(
                              'text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all',
                              onDeviceEmbedId === m.id
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]',
                            )}
                          >
                            {onDeviceEmbedId === m.id ? '✓ Embeddings' : 'Set as embedding model'}
                          </button>
                        )}
                        {(m.capability === 'chat' || m.capability === 'both') && (
                          <button
                            onClick={() => {
                              handleSetOnDeviceChat(m.id).catch(() => {});
                            }}
                            className={cn(
                              'text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all',
                              onDeviceChatId === m.id
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]',
                            )}
                          >
                            {onDeviceChatId === m.id ? '✓ Chat model' : 'Set as chat model'}
                          </button>
                        )}
                        {m.capability === 'tts' && (
                          <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-green-200 text-green-700 bg-green-50">
                            ✓ Installed
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── APPEARANCE TAB ────────────────────────────────────────────── */}
        {tab === 'appearance' && (
          <div className="bg-white rounded-xl border border-[var(--color-hairline)] p-6 space-y-5">
            <div>
              <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">
                Theme
              </label>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      'flex-1 py-2 text-[13px] font-medium rounded-md border transition-all',
                      theme === t
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                        : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                    )}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">
                Font
              </label>
              <div className="flex gap-2">
                {(['mono', 'serif', 'sans'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFontFamily(f)}
                    className={cn(
                      'flex-1 py-2 text-[13px] font-medium rounded-md border transition-all',
                      fontFamily === f
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                        : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                    )}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">
                Font Size
              </label>
              <div className="flex gap-2">
                {(['sm', 'md', 'lg'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFontSize(s)}
                    className={cn(
                      'flex-1 py-2 font-medium rounded-md border transition-all',
                      fontSize === s
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                        : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                      s === 'sm' && 'text-[12px]',
                      s === 'md' && 'text-[14px]',
                      s === 'lg' && 'text-[16px]',
                    )}
                  >
                    {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">
                Accent Color
              </label>
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
              onClick={() => {
                handleSave().catch(() => {});
              }}
              className="notion-btn-primary w-full text-[14px] mt-2"
            >
              {saved ? 'Saved ✓' : 'Save Settings'}
            </button>
          </div>
        )}

        {/* ── ACTIVITY LOG (always visible at bottom) ───────────────────── */}
        <section className="mt-8 space-y-3">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => {
              if (!showLog) setLogEntries([...log.getBuffer()]);
              setShowLog((v) => !v);
            }}
          >
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">Activity Log</h2>
              <p className="text-[12px] text-[var(--color-ink-muted)] mt-0.5">
                Last {log.getBuffer().length} events in memory
              </p>
            </div>
            <span className="text-[12px] text-[var(--color-ink-faint)]">
              {showLog ? '▲ Hide' : '▼ Show'}
            </span>
          </div>
          {showLog && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'error', 'warn', 'info', 'success'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={cn(
                      'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all capitalize',
                      logFilter === f
                        ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]',
                    )}
                  >
                    {f === 'all'
                      ? `All (${logEntries.length})`
                      : `${f} (${logEntries.filter((e) => e.level === f).length})`}
                  </button>
                ))}
                <button
                  onClick={() => setLogEntries([...log.getBuffer()])}
                  className="ml-auto text-[10px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={() => {
                    const json = JSON.stringify(logEntries, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `notch-log-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[10px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  Export JSON
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] text-[11px] font-mono">
                {logEntries
                  .filter((e) => logFilter === 'all' || e.level === logFilter)
                  .slice()
                  .reverse()
                  .map((entry, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2 px-3 py-1.5 border-b border-[var(--color-hairline)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors',
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 font-bold w-12 text-[10px]',
                          entry.level === 'error'
                            ? 'text-[var(--color-destructive)]'
                            : entry.level === 'warn'
                              ? 'text-amber-500'
                              : entry.level === 'success'
                                ? 'text-emerald-500'
                                : 'text-[var(--color-primary)]',
                        )}
                      >
                        {entry.level.slice(0, 4).toUpperCase()}
                      </span>
                      <span className="text-[var(--color-ink-faint)] shrink-0 w-20">
                        {entry.ts.slice(11, 19)}
                      </span>
                      <span className="text-[var(--color-ink-muted)] shrink-0 w-20 truncate">
                        {entry.module}
                      </span>
                      <span className="text-[var(--color-ink)] flex-1 truncate">
                        {entry.message}
                      </span>
                    </div>
                  ))}
                {logEntries.filter((e) => logFilter === 'all' || e.level === logFilter).length ===
                  0 && (
                  <p className="text-center text-[var(--color-ink-faint)] py-4">No log entries</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
