import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { ModelCombobox } from '@/components/ModelCombobox';
import { fetchAvailableModels, type ModelOption } from '@/lib/models-api';

interface ProviderPreset {
  id: string;
  label: string;
  keyUrl: string;
  keyHint: string;
  baseUrl: string;
  protocol: 'openai' | 'anthropic';
  defaultModel: string;
}

const PRESETS: ProviderPreset[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-...',
    baseUrl: 'https://openrouter.ai/api/v1',
    protocol: 'openai',
    defaultModel: 'openrouter/free',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-...',
    baseUrl: 'https://api.anthropic.com',
    protocol: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-...',
    baseUrl: 'https://api.openai.com/v1',
    protocol: 'openai',
    defaultModel: 'gpt-4o-mini',
  },
];

export function ApiSetup({
  selectedProvider,
  apiKey,
  chatModel,
  onProviderChange,
  onApiKeyChange,
  onModelChange,
}: {
  selectedProvider: string;
  apiKey: string;
  chatModel: string;
  onProviderChange: (id: string) => void;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | undefined>();
  const activePreset = PRESETS.find((p) => p.id === selectedProvider);

  const refreshModels = useCallback(async () => {
    if (!activePreset?.baseUrl) return;
    setModelsLoading(true);
    setModelsError(undefined);
    try {
      const list = await fetchAvailableModels(activePreset.baseUrl, apiKey || undefined);
      setModels(list);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Could not load models');
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [activePreset, apiKey]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center max-w-md">
        <h2 className="text-[26px] font-bold text-ink mb-2 tracking-[-0.02em]">
          Connect your AI provider
        </h2>
        <p className="text-[14px] text-ink-muted">
          Notch uses your own API key. Choose a provider and enter your key.
        </p>
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-2 gap-2.5 w-full max-w-md">
        {PRESETS.map((p) => {
          const active = selectedProvider === p.id;
          return (
            <motion.button
              key={p.id}
              onClick={() => {
                onProviderChange(p.id);
                onModelChange(p.defaultModel);
              }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              className={`relative rounded-xl border p-3.5 text-left transition-all ${
                active
                  ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                  : 'border-hairline bg-card hover:border-ink-faint'
              }`}
              aria-pressed={active}
            >
              {active && (
                <motion.div
                  layoutId="provider-bg"
                  className="absolute inset-0 rounded-xl border-2 border-primary"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <div className="relative z-10">
                <p className="text-[13px] font-semibold text-ink">{p.label}</p>
                <p className="text-[11px] text-ink-muted mt-0.5">{p.protocol}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Key input */}
      {activePreset && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-4"
        >
          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide block mb-1.5">
              API key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder={activePreset.keyHint}
                autoComplete="off"
                spellCheck={false}
                className="notion-input pr-20 text-[13px]"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="p-1.5 rounded-md text-ink-faint hover:text-ink transition-colors"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-ink-faint">
                Stored locally. Never sent to Notch servers.
              </p>
              <a
                href={activePreset.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Get key <ExternalLink size={10} />
              </a>
            </div>
          </div>

          {/* Model selection */}
          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide block mb-1.5">
              Model
            </label>
            <ModelCombobox
              value={chatModel}
              onChange={onModelChange}
              options={models}
              loading={modelsLoading}
              error={modelsError}
              onRefresh={() => {
                refreshModels().catch(() => {});
              }}
              placeholder="Search or type model name..."
            />
            <p className="text-[11px] text-ink-faint mt-1">
              Used for summarisation and AI processing. Models refresh automatically.
            </p>
          </div>
        </motion.div>
      )}

      {/* Skip option */}
      <p className="text-[12px] text-ink-faint text-center max-w-sm">
        Don't have a key yet? You can configure this later in Settings.
      </p>
    </div>
  );
}

export { PRESETS };
