import { useState } from 'react';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import { getSettings, saveSettings } from '@/lib/storage';
import {
  ONBOARDING_PROVIDERS,
  getOnboardingProvider,
  cloudSettingsPatch,
  localOnlySettingsPatch,
} from '@/lib/onboarding';
import type { Settings } from '@/lib/types';

type Step = 'intro' | 'choose' | 'key' | 'done';

const PERMISSIONS: Array<{ name: string; why: string }> = [
  { name: 'Active tab', why: 'Read the page you choose to capture — only when you click capture.' },
  { name: 'Tabs', why: 'Open the reader and library in their own tabs.' },
  { name: 'Storage', why: 'Save your notes and API key locally on this device.' },
];

async function applyPatch(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await saveSettings({ ...current, ...patch });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas-soft)] text-[var(--color-ink)] flex items-center justify-center p-8">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}

export default function WelcomeApp() {
  const [step, setStep] = useState<Step>('intro');
  const [providerId, setProviderId] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  async function finish() {
    await browser.storage.local.set({ 'notch:onboarded': true });
    setStep('done');
  }

  async function chooseLocal() {
    setSaving(true);
    await applyPatch(localOnlySettingsPatch());
    setSaving(false);
    await finish();
  }

  async function saveCloud() {
    const p = getOnboardingProvider(providerId);
    if (!p || !apiKey.trim()) return;
    setSaving(true);
    await applyPatch(cloudSettingsPatch(p, apiKey));
    setSaving(false);
    await finish();
  }

  function openLibrary() {
    browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') });
  }

  const activeProvider = getOnboardingProvider(providerId);

  return (
    <Shell>
      {step === 'intro' && (
        <div className="notion-card-elevated text-center flex flex-col items-center gap-5 py-10">
          <span className="notion-badge-pill">Welcome</span>
          <h1 className="notion-display-1 max-w-md">Turn any page into notes you can talk to.</h1>
          <p className="notion-body text-[var(--color-ink-muted)] max-w-md">
            Notch captures what you read, structures it, and lets you ask questions about it —
            using your own AI key or fully on your device.
          </p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setStep('choose')} className="notion-btn-primary">Get started</button>
            <button onClick={finish} className="notion-btn-utility">Skip for now</button>
          </div>
        </div>
      )}

      {step === 'choose' && (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <h2 className="notion-heading-2">How do you want to use Notch?</h2>
            <p className="notion-caption mt-1">You can change this anytime in Settings.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setStep('key')}
              className="notion-card text-left flex flex-col gap-2 hover:border-[var(--color-primary)]"
            >
              <span className="notion-title">Use my own AI key</span>
              <span className="notion-body-sm text-[var(--color-ink-muted)]">
                Best quality. Bring a key from Anthropic, Gemini or OpenRouter. Two taps to set up.
              </span>
            </button>
            <button
              onClick={chooseLocal}
              disabled={saving}
              className="notion-card text-left flex flex-col gap-2 hover:border-[var(--color-primary)] disabled:opacity-60"
            >
              <span className="notion-title">Stay on-device</span>
              <span className="notion-body-sm text-[var(--color-ink-muted)]">
                Private and free. No key needed — capture and chat never leave your device.
              </span>
            </button>
          </div>
          <button onClick={finish} className="notion-caption text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] mx-auto">
            Skip for now
          </button>
        </div>
      )}

      {step === 'key' && (
        <div className="notion-card-elevated flex flex-col gap-4">
          <h2 className="notion-heading-2">Connect your AI key</h2>

          <div className="flex flex-wrap gap-2">
            {ONBOARDING_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setProviderId(p.id)}
                className={cn(
                  'text-[13px] font-medium px-3 py-1.5 rounded-full border transition-all',
                  providerId === p.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {activeProvider && (
            <>
              <a
                href={activeProvider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="notion-btn-utility w-fit"
              >
                Get a {activeProvider.label} key ↗
              </a>
              <div>
                <label className="notion-eyebrow text-[var(--color-ink-muted)] block mb-1">Paste your key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={activeProvider.keyHint}
                  autoComplete="off"
                  spellCheck={false}
                  className="notion-input"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={saveCloud}
              disabled={saving || !apiKey.trim()}
              className="notion-btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & finish'}
            </button>
            <button onClick={() => setStep('choose')} className="notion-btn-utility">Back</button>
          </div>
          <p className="notion-caption">Your key is stored only on this device and never synced.</p>
        </div>
      )}

      {step === 'done' && (
        <div className="notion-card-elevated flex flex-col gap-5">
          <div className="text-center flex flex-col items-center gap-2">
            <span className="notion-badge-pill">All set</span>
            <h2 className="notion-heading-2">You're ready to go.</h2>
            <p className="notion-body text-[var(--color-ink-muted)] max-w-md">
              Open any web page and click the Notch icon to capture it. Your notes land in the library.
            </p>
          </div>

          <div className="notion-card">
            <p className="notion-eyebrow text-[var(--color-ink-muted)] mb-2">What Notch can access</p>
            <div className="flex flex-col gap-2">
              {PERMISSIONS.map((p) => (
                <div key={p.name} className="flex gap-2">
                  <span className="notion-body-sm font-semibold min-w-24 shrink-0">{p.name}</span>
                  <span className="notion-body-sm text-[var(--color-ink-muted)]">{p.why}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={openLibrary} className="notion-btn-primary">Open my library</button>
            <button onClick={() => browser.runtime.openOptionsPage()} className="notion-btn-utility">Open settings</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
