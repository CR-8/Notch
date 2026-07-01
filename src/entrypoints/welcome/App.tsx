import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import { log } from '@/lib/logger';
import { getSettings, saveSettings } from '@/lib/storage';
import { openSettings } from '@/lib/navigation';
import {
  ONBOARDING_PROVIDERS,
  getOnboardingProvider,
  cloudSettingsPatch,
  localOnlySettingsPatch,
} from '@/lib/onboarding';
import {
  LOCAL_MODELS,
  getOnDeviceConfig,
  saveOnDeviceConfig,
  type LocalModelDef,
  type ModelStatus,
} from '@/lib/on-device';
import type { Settings } from '@/lib/types';

type Step = 'intro' | 'demo' | 'choose' | 'key' | 'local-model' | 'done';

const PERMISSIONS: Array<{ name: string; why: string }> = [
  { name: 'Active tab', why: 'Read page text only when you click Capture.' },
  { name: 'Tabs', why: 'Open notes and library in their own browser tabs.' },
  { name: 'Storage', why: 'Save your notes and API keys securely on this device.' },
];

async function applyPatch(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await saveSettings({ ...current, ...patch });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas-soft)] text-[var(--color-ink)] flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      <div className="welcome-grid-bg" />
      <div className="w-full max-w-2xl relative z-10">{children}</div>
    </div>
  );
}

// ── Model picker step helpers ─────────────────────────────────────────────────

interface ModelCardProps {
  model: LocalModelDef;
  status: ModelStatus;
  progress: number;
  isEmbeddingChoice: boolean;
  isChatChoice: boolean;
  onInstall: () => void;
  onSetEmbedding: () => void;
  onSetChat: () => void;
  gpuAvailable: boolean;
}

function ModelCard({
  model,
  status,
  progress,
  isEmbeddingChoice,
  isChatChoice,
  onInstall,
  onSetEmbedding,
  onSetChat,
  gpuAvailable,
}: ModelCardProps) {
  const isUnavailable = model.backend === 'webgpu' && !gpuAvailable;
  const isReady = status === 'ready';
  const isDownloading = status === 'downloading';

  return (
    <div
      className={cn(
        'bg-[var(--color-surface)] rounded-xl border p-4 flex flex-col gap-3 transition-all',
        isUnavailable
          ? 'opacity-40 border-[var(--color-hairline)]'
          : 'border-[var(--color-hairline)] hover:border-[var(--color-primary)]/40',
        isReady && 'border-[var(--color-success)]/40 bg-[var(--color-canvas-soft)]/20',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[13px] font-semibold text-[var(--color-ink)] leading-none">
              {model.label}
            </span>
            <span
              className={cn(
                'text-[9px] font-semibold px-2 py-0.5 rounded-full leading-none',
                model.backend === 'webgpu'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
              )}
            >
              {model.backend === 'webgpu' ? 'WebGPU' : 'WASM'}
            </span>
            <span className="text-[10px] text-[var(--color-ink-faint)] leading-none">
              {model.sizeLabel}
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-ink-muted)] leading-snug">
            {model.description}
          </p>
          {isUnavailable && (
            <p className="text-[10px] text-amber-600 mt-1 font-medium">
              WebGPU not available in this browser
            </p>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end">
          {isReady ? (
            <span className="text-[11px] font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
              <span>✓</span> Installed
            </span>
          ) : isDownloading ? (
            <span className="text-[11px] font-semibold text-[var(--color-primary)] animate-pulse">
              {progress}%
            </span>
          ) : (
            <button
              onClick={onInstall}
              disabled={isUnavailable}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-active)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {(isReady || isDownloading) && (
        <div className="flex gap-2 mt-1">
          {(model.capability === 'embedding' || model.capability === 'both') && (
            <button
              onClick={onSetEmbedding}
              className={cn(
                'text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all text-left cursor-pointer',
                isEmbeddingChoice
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)] font-semibold'
                  : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]',
              )}
            >
              {isEmbeddingChoice ? '✓ Used for search' : 'Use for search'}
            </button>
          )}
          {(model.capability === 'chat' || model.capability === 'both') && (
            <button
              onClick={onSetChat}
              className={cn(
                'text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all text-left cursor-pointer',
                isChatChoice
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)] font-semibold'
                  : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]',
              )}
            >
              {isChatChoice ? '✓ Used for chat' : 'Use for chat'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main welcome app ──────────────────────────────────────────────────────────

export default function WelcomeApp() {
  const [step, setStep] = useState<Step>('intro');
  const [providerId, setProviderId] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // ONB-1: live demo state
  const [demoState, setDemoState] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');
  const [demoDocId, setDemoDocId] = useState<string | null>(null);
  const [demoTitle, setDemoTitle] = useState<string>('');
  const [demoLogs, setDemoLogs] = useState<string[]>([]);

  // On-device model state
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [modelProgress, setModelProgress] = useState<Record<string, number>>({});
  const [embeddingModelId, setEmbeddingModelId] = useState<string | null>('minilm-l6');
  const [chatModelId, setChatModelId] = useState<string | null>('smollm2-135m');
  const [gpuAvailable, setGpuAvailable] = useState(false);

  // Load existing config when entering model step
  useEffect(() => {
    if (step !== 'local-model') return;
    void getOnDeviceConfig().then((cfg) => {
      setModelStatuses(cfg.status);
      setModelProgress(cfg.progress);
      if (cfg.embeddingModelId) setEmbeddingModelId(cfg.embeddingModelId);
      if (cfg.chatModelId) setChatModelId(cfg.chatModelId);
    });

    // Check WebGPU
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
  }, [step]);

  // Listen for MODEL_DOWNLOAD_PROGRESS / COMPLETE / ERROR from background
  useEffect(() => {
    if (step !== 'local-model') return;
    function onMsg(msg: unknown) {
      const m = msg as { type?: string; payload?: Record<string, number | string> };
      const payload = m?.payload;
      if (!payload) return;
      if (m?.type === 'MODEL_DOWNLOAD_PROGRESS') {
        setModelProgress((prev) => ({
          ...prev,
          [String(payload.modelId ?? '')]: Number(payload.pct ?? 0),
        }));
        setModelStatuses((prev) => ({ ...prev, [String(payload.modelId ?? '')]: 'downloading' }));
      } else if (m?.type === 'MODEL_DOWNLOAD_COMPLETE') {
        setModelStatuses((prev) => ({ ...prev, [String(payload.modelId ?? '')]: 'ready' }));
        setModelProgress((prev) => ({ ...prev, [String(payload.modelId ?? '')]: 100 }));
      } else if (m?.type === 'MODEL_DOWNLOAD_ERROR') {
        setModelStatuses((prev) => ({ ...prev, [String(payload.modelId ?? '')]: 'error' }));
      }
    }
    browser.runtime.onMessage.addListener(onMsg);
    return () => browser.runtime.onMessage.removeListener(onMsg);
  }, [step]);

  function finish() {
    void browser.storage.local.set({ 'notch:onboarded': true }).then(() => {
      setStep('done');
    });
  }

  function chooseLocal() {
    setSaving(true);
    void applyPatch(localOnlySettingsPatch()).then(() => {
      setSaving(false);
      setStep('local-model');
    });
  }

  function saveCloud() {
    const p = getOnboardingProvider(providerId);
    if (!p || !apiKey.trim()) return;
    setSaving(true);
    void applyPatch(cloudSettingsPatch(p, apiKey)).then(() => {
      setSaving(false);
      finish();
    });
  }

  function finishLocalModel() {
    void (async () => {
      const cfg = await getOnDeviceConfig();
      cfg.embeddingModelId = embeddingModelId;
      cfg.chatModelId = chatModelId;
      cfg.enabled = true;
      await saveOnDeviceConfig(cfg);
      finish();
    })();
  }

  function installModel(modelId: string) {
    setModelStatuses((prev) => ({ ...prev, [modelId]: 'downloading' }));
    setModelProgress((prev) => ({ ...prev, [modelId]: 0 }));
    void browser.runtime.sendMessage({ type: 'MODEL_DOWNLOAD_START', payload: { modelId } });
  }

  async function startDemo() {
    setDemoState('capturing');
    setDemoLogs(['[→] Querying tabs to find active web content...']);
    try {
      // Find the most recent non-welcome tab
      const allTabs = await browser.tabs.query({ currentWindow: true });
      const targetTab = allTabs.find(
        (t) =>
          t.url &&
          !t.url.startsWith(browser.runtime.getURL('')) &&
          !t.url.startsWith('chrome://') &&
          !t.url.startsWith('about:'),
      );
      if (!targetTab?.id)
        throw new Error('No active web page found. Open a site in another tab and retry.');
      setDemoTitle(targetTab.title ?? 'Untitled page');
      setDemoLogs((prev) => [
        ...prev,
        `[✓] Target page found: "${targetTab.title}"`,
        `[→] Capturing text content from ${new URL(targetTab.url!).hostname}...`,
      ]);

      // Listen for progress
      const progressHandler = (msg: unknown) => {
        const m = msg as { type?: string; payload?: Record<string, string | number> };
        if (m?.type === 'CAPTURE_PROGRESS') {
          setDemoLogs((prev) => [...prev, `[→] ${String(m.payload?.step ?? '')}`]);
        }
      };
      browser.runtime.onMessage.addListener(progressHandler);

      const resp: { type?: string; payload?: { documentId?: string; error?: string } } | undefined =
        await browser.runtime.sendMessage({
          type: 'CAPTURE_PAGE',
          payload: {
            mode: 'FAST',
            tags: ['onboarding-demo'],
            tabId: targetTab.id,
            url: targetTab.url,
          },
        });

      browser.runtime.onMessage.removeListener(progressHandler);

      if (resp?.type === 'CAPTURE_COMPLETE' && resp.payload?.documentId) {
        setDemoDocId(resp.payload.documentId);
        setDemoLogs((prev) => [
          ...prev,
          `[✓] Summaries generated successfully`,
          `[✓] Knowledge graph structured`,
          `[✓] Note indexed in local database`,
        ]);
        setDemoState('done');
      } else {
        throw new Error(resp?.payload?.error ?? 'Capture failed');
      }
    } catch (err) {
      log.error('ONBOARDING', 'Demo capture failed', err);
      setDemoLogs((prev) => [
        ...prev,
        `[✗] Error: ${err instanceof Error ? err.message : String(err)}`,
      ]);
      setDemoState('error');
    }
  }

  function openDemoDoc() {
    if (demoDocId) {
      void browser.tabs.create({
        url: browser.runtime.getURL(`/reader.html?documentId=${demoDocId}`),
      });
    }
  }

  function openLibrary() {
    void browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') });
  }

  const activeProvider = getOnboardingProvider(providerId);
  const embeddingModels = LOCAL_MODELS.filter(
    (m) => m.capability === 'embedding' || m.capability === 'both',
  );
  const chatModels = LOCAL_MODELS.filter((m) => m.capability === 'chat' || m.capability === 'both');

  return (
    <Shell>
      {step === 'intro' && (
        <div className="welcome-glass p-8 sm:p-12 welcome-step-card text-center flex flex-col items-center gap-6">
          <span className="notion-badge-pill border-neutral-300 dark:border-neutral-700 bg-white/50 text-[11px] font-bold tracking-wider uppercase">
            Welcome to Notch
          </span>

          <div className="space-y-3">
            <h1 className="welcome-gradient-title text-[32px] sm:text-[40px] font-extrabold tracking-tight uppercase leading-none">
              Turn any page into notes you can talk to.
            </h1>
            <p className="notion-body text-[var(--color-ink-muted)] max-w-lg mx-auto">
              Notch captures what you read, structures it, and lets you ask questions about it —
              using your own AI key or fully offline on your device.
            </p>
          </div>

          <div className="w-full border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)]/50 rounded-xl p-4 flex flex-col items-center gap-2 max-w-md my-1">
            <span className="text-[12px] font-semibold text-[var(--color-ink-muted)] flex items-center gap-1.5">
              <span className="pulsing-dot" /> Live Webpage Capture Preview
            </span>
            <div className="text-[11px] text-[var(--color-ink-faint)] leading-snug text-center">
              "When you click see it in action, Notch automatically reads your other active tab and
              creates a clean summary & keypoints graph in 10 seconds."
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full justify-center">
            <button
              onClick={() => setStep('choose')}
              className="notion-btn-primary px-8 py-3 text-[15px] font-semibold cursor-pointer"
            >
              Get started
            </button>
            <button
              onClick={() => {
                setStep('demo');
                void startDemo();
              }}
              className="notion-btn-utility px-6 py-3 text-[14px] font-semibold cursor-pointer"
            >
              See it in action ↗
            </button>
          </div>

          <button
            onClick={() => {
              finish();
            }}
            className="text-[12px] font-medium text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            Skip setup for now
          </button>
        </div>
      )}

      {/* ONB-1: Live demo step */}
      {step === 'demo' && (
        <div className="welcome-glass p-8 sm:p-12 welcome-step-card flex flex-col gap-6 items-center text-center">
          {demoState === 'capturing' && (
            <>
              <span className="text-[36px] animate-pulse">🧠</span>
              <div className="space-y-1">
                <h2 className="notion-heading-2 welcome-gradient-title">Capturing active tab...</h2>
                {demoTitle && (
                  <p className="text-[13px] font-medium text-[var(--color-ink-muted)] max-w-sm truncate mx-auto">
                    "{demoTitle}"
                  </p>
                )}
              </div>

              {/* Glowing animated progress loader */}
              <div className="w-full max-w-sm h-1.5 bg-[var(--color-canvas-soft)] rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-neutral-400 via-neutral-900 to-neutral-400 dark:from-neutral-700 dark:via-white dark:to-neutral-700 rounded-full animate-[shimmer_1.5s_infinite_linear]"
                  style={{ width: '100%', backgroundSize: '200% 100%' }}
                />
              </div>

              <div className="welcome-terminal w-full max-w-md">
                <p className="text-[10px] uppercase font-bold text-[var(--color-ink-faint)] mb-2 border-b border-[#222] pb-1.5">
                  Extraction Console Output
                </p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {demoLogs.map((logLine, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'terminal-line',
                        idx === demoLogs.length - 1 && 'terminal-line-active',
                      )}
                    >
                      {logLine}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {demoState === 'done' && (
            <>
              <span className="text-[36px]">✅</span>
              <div className="space-y-1">
                <h2 className="notion-heading-2 welcome-gradient-title">First note created!</h2>
                <p className="text-[13px] text-[var(--color-ink-muted)] max-w-sm truncate mx-auto">
                  Summarised & indexed:{' '}
                  <span className="font-semibold text-[var(--color-ink)]">"{demoTitle}"</span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-3">
                <button
                  onClick={openDemoDoc}
                  className="notion-btn-primary px-6 py-2.5 cursor-pointer"
                >
                  Open in Reader
                </button>
                <button
                  onClick={() => setStep('choose')}
                  className="notion-btn-utility px-6 py-2.5 cursor-pointer"
                >
                  Continue Setup
                </button>
              </div>
            </>
          )}

          {demoState === 'error' && (
            <>
              <span className="text-[36px]">⚠️</span>
              <h2 className="notion-heading-2 text-[var(--color-destructive)]">Capture failed</h2>
              <div className="welcome-terminal w-full max-w-md my-1">
                <div className="space-y-1">
                  {demoLogs.map((logLine, idx) => (
                    <div
                      key={idx}
                      className="terminal-line text-[var(--color-destructive)] opacity-90"
                    >
                      {logLine}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[13px] text-[var(--color-ink-muted)] max-w-sm">
                No worries! Let's complete the configuration first. You can bring an API key or set
                up on-device AI.
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep('choose')}
                  className="notion-btn-primary cursor-pointer"
                >
                  Set up now
                </button>
                <button
                  onClick={() => {
                    finish();
                  }}
                  className="notion-btn-utility cursor-pointer"
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'choose' && (
        <div className="welcome-step-card flex flex-col gap-6">
          <div className="text-center space-y-1">
            <h2 className="text-[26px] font-bold tracking-tight uppercase welcome-gradient-title">
              How do you want to use Notch?
            </h2>
            <p className="text-[13px] text-[var(--color-ink-muted)]">
              You can change this configuration at any time in Settings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <button
              onClick={() => setStep('key')}
              className="welcome-choice-card choice-card-cloud text-left flex flex-col gap-3 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[24px]">☁️</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-info)] bg-[var(--color-info)]/10 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[16px] font-bold text-[var(--color-ink)] block group-hover:text-[var(--color-primary)]">
                  Use my own AI key
                </span>
                <span className="text-[12px] text-[var(--color-ink-muted)] leading-snug block">
                  Best quality. Bring a key from Anthropic, Gemini, or OpenRouter. Set up in two
                  taps.
                </span>
              </div>
              <div className="border-t border-[var(--color-hairline)] pt-2.5 mt-1 space-y-1">
                <div className="text-[11px] text-[var(--color-ink-muted)] flex items-center gap-1.5">
                  <span className="text-[12px] text-[var(--color-info)]">✓</span> State-of-the-art
                  accuracy
                </div>
                <div className="text-[11px] text-[var(--color-ink-muted)] flex items-center gap-1.5">
                  <span className="text-[12px] text-[var(--color-info)]">✓</span> Sub-second
                  response times
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                chooseLocal();
              }}
              disabled={saving}
              className="welcome-choice-card choice-card-local text-left flex flex-col gap-3 group disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <span className="text-[24px]">🔒</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 dark:bg-green-950/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                  Local &amp; Free
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[16px] font-bold text-[var(--color-ink)] block group-hover:text-[var(--color-primary)]">
                  Stay fully on-device
                </span>
                <span className="text-[12px] text-[var(--color-ink-muted)] leading-snug block">
                  100% private. Run a lightweight AI model directly in your browser.
                </span>
              </div>
              <div className="border-t border-[var(--color-hairline)] pt-2.5 mt-1 space-y-1">
                <div className="text-[11px] text-[var(--color-ink-muted)] flex items-center gap-1.5">
                  <span className="text-[12px] text-green-600">✓</span> No internet connection
                  required
                </div>
                <div className="text-[11px] text-[var(--color-ink-muted)] flex items-center gap-1.5">
                  <span className="text-[12px] text-green-600">✓</span> 0% data leaves your computer
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={finish}
            className="text-[12px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] transition-colors mx-auto cursor-pointer"
          >
            Skip setup for now
          </button>
        </div>
      )}

      {step === 'key' && (
        <div className="welcome-glass p-8 sm:p-12 welcome-step-card flex flex-col gap-5">
          <div className="space-y-1">
            <h2 className="notion-heading-2 welcome-gradient-title">Connect your AI key</h2>
            <p className="text-[13px] text-[var(--color-ink-muted)]">
              Select your provider and paste your API key to get started.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mt-1">
            {ONBOARDING_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProviderId(p.id);
                  setApiKey('');
                }}
                className={cn(
                  'text-[12px] font-medium px-4 py-1.5 rounded-full border transition-all cursor-pointer',
                  providerId === p.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5 font-semibold'
                    : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {activeProvider && (
            <div className="space-y-4 mt-2">
              <a
                href={activeProvider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
              >
                Get a {activeProvider.label} API key ↗
              </a>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-wide block">
                  Paste your key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={activeProvider.keyHint}
                    autoComplete="off"
                    spellCheck={false}
                    className="notion-input pr-12 text-[14px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-3 border-t border-[var(--color-hairline)]">
            <button
              onClick={() => {
                saveCloud();
              }}
              disabled={saving || !apiKey.trim()}
              className="notion-btn-primary px-6 py-2.5 text-[14px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save & finish'}
            </button>
            <button
              onClick={() => setStep('choose')}
              className="notion-btn-utility px-6 py-2.5 text-[14px] cursor-pointer"
            >
              Back
            </button>
          </div>
          <p className="text-[11px] text-[var(--color-ink-faint)]">
            Security Guarantee: Your API key is encrypted and stored locally only. It is never
            uploaded to any sync server.
          </p>
        </div>
      )}

      {step === 'local-model' && (
        <div className="welcome-step-card flex flex-col gap-5">
          <div className="text-center space-y-1">
            <h2 className="text-[26px] font-bold welcome-gradient-title uppercase">
              Choose on-device models
            </h2>
            <p className="text-[12px] text-[var(--color-ink-muted)] max-w-lg mx-auto">
              Notch requires an <strong>embedding</strong> model (for search &amp; related notes)
              and a <strong>chat</strong> model (for Q&amp;A summaries). The defaults are
              lightweight and run offline on any computer.
            </p>
          </div>

          <div className="space-y-4 mt-2">
            {/* Embedding models */}
            <div>
              <p className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-wider mb-2">
                1. Embedding Model{' '}
                <span className="font-normal normal-case text-[var(--color-ink-faint)]">
                  — powers semantic search &amp; indexing
                </span>
              </p>
              <div className="grid gap-2.5">
                {embeddingModels.map((m) => (
                  <ModelCard
                    key={m.id}
                    model={m}
                    status={modelStatuses[m.id] ?? 'not-installed'}
                    progress={modelProgress[m.id] ?? 0}
                    isEmbeddingChoice={embeddingModelId === m.id}
                    isChatChoice={false}
                    onInstall={() => installModel(m.id)}
                    onSetEmbedding={() => setEmbeddingModelId(m.id)}
                    onSetChat={() => {}}
                    gpuAvailable={gpuAvailable}
                  />
                ))}
              </div>
            </div>

            {/* Chat models */}
            <div>
              <p className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-wider mb-2">
                2. Chat Model{' '}
                <span className="font-normal normal-case text-[var(--color-ink-faint)]">
                  — powers summaries and section structuring
                </span>
              </p>
              <div className="grid gap-2.5">
                {chatModels.map((m) => (
                  <ModelCard
                    key={m.id}
                    model={m}
                    status={modelStatuses[m.id] ?? 'not-installed'}
                    progress={modelProgress[m.id] ?? 0}
                    isEmbeddingChoice={false}
                    isChatChoice={chatModelId === m.id}
                    onInstall={() => installModel(m.id)}
                    onSetEmbedding={() => {}}
                    onSetChat={() => setChatModelId(m.id)}
                    gpuAvailable={gpuAvailable}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-[var(--color-hairline)]">
            <button
              onClick={() => {
                finishLocalModel();
              }}
              className="notion-btn-primary px-6 py-2.5 text-[14px] cursor-pointer"
            >
              Finish Setup →
            </button>
            <button
              onClick={() => {
                finish();
              }}
              className="notion-btn-utility px-6 py-2.5 text-[14px] cursor-pointer"
            >
              Skip model downloads
            </button>
          </div>
          <p className="text-[11px] text-[var(--color-ink-faint)] text-center leading-normal">
            Models download directly from Hugging Face Hub and are cached securely in your browser
            storage. You can continue and use Notch immediately while downloads happen in the
            background.
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="welcome-glass p-8 sm:p-12 welcome-step-card flex flex-col gap-6 text-center items-center">
          <div className="space-y-1">
            <span className="notion-badge-pill border-green-300 bg-green-50/50 text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400 text-[11px] font-bold tracking-wider uppercase">
              Setup Completed
            </span>
            <h2 className="text-[32px] font-extrabold uppercase welcome-gradient-title leading-tight mt-2">
              You're ready to use Notch.
            </h2>
            <p className="notion-body text-[var(--color-ink-muted)] max-w-sm mx-auto mt-1">
              Open any webpage or PDF document and click the Notch extension icon to capture it.
            </p>
          </div>

          <div className="w-full border border-[var(--color-hairline)] rounded-xl bg-[var(--color-canvas-soft)]/40 p-5 text-left max-w-md my-1">
            <p className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-wider mb-2">
              Permissions &amp; Privacy Overview
            </p>
            <div className="space-y-2.5">
              {PERMISSIONS.map((p) => (
                <div key={p.name} className="flex gap-3 items-start">
                  <span className="text-green-600 dark:text-green-400 text-[14px] font-bold leading-none mt-0.5">
                    ✓
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--color-ink)] leading-none mb-0.5">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-[var(--color-ink-muted)] leading-normal">
                      {p.why}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-2">
            <button
              onClick={() => {
                openLibrary();
              }}
              className="notion-btn-primary px-8 py-3 text-[15px] font-semibold cursor-pointer"
            >
              Open My Library
            </button>
            <button
              onClick={() => {
                void openSettings();
              }}
              className="notion-btn-utility px-6 py-3 text-[14px] font-semibold cursor-pointer"
            >
              Open Settings
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
