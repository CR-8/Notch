import { useState, useCallback, createContext, useContext, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Onboarding, useOnboarding } from '@/components/ui/onboarding';
import { browser } from 'wxt/browser';
import {
  getSettings,
  saveSettings,
  getAppearance,
  saveAppearance,
  saveProvider,
  saveDocument,
} from '@/lib/storage';
import { applyAppearance } from '@/lib/theme';
import { log } from '@/lib/logger';
import {
  WelcomeHero,
  ApiSetup,
  PersonalizeStep,
  PermissionCard,
  DemoVideo,
  SuccessScreen,
  ProgressHeader,
  StepLabel,
  NavigationFooter,
} from './index';
import type { OnboardingConfig } from './types';
import type { ProviderConfig, Document } from '@/lib/types';
import { PRESETS } from './ApiSetup';

interface OnboardingData {
  config: OnboardingConfig;
  updateConfig: (patch: Partial<OnboardingConfig>) => void;
}

const OnboardingDataContext = createContext<OnboardingData | null>(null);

function useData() {
  const ctx = useContext(OnboardingDataContext);
  if (!ctx) throw new Error('Missing OnboardingDataContext');
  return ctx;
}

function CurrentStepIndicator() {
  const onboarding = useOnboarding();
  return <StepLabel currentStep={onboarding.currentStep} />;
}

const DEMO_DOC_ID = 'onboarding:demo:artificial-intelligence';

function demoDocument(): Document {
  const now = new Date().toISOString();
  return {
    id: DEMO_DOC_ID,
    title: 'Artificial intelligence — Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
    domain: 'en.wikipedia.org',
    capturedAt: now,
    wordCount: 1243,
    cleanedHtml: '<p>Artificial intelligence (AI) is intelligence demonstrated by machines...</p>',
    textContent:
      'Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any system that perceives its environment and takes actions that maximize its chance of achieving its goals.',
    summary:
      'Artificial intelligence (AI) is intelligence demonstrated by machines, encompassing everything from rule-based systems to deep learning. Modern AI applications include natural language processing, computer vision, and robotics.',
    keyPoints: [
      'AI is intelligence demonstrated by machines, not humans',
      'The field studies "intelligent agents" that perceive and act',
      'Applications span NLP, computer vision, and robotics',
      'Modern AI includes machine learning and deep learning approaches',
    ],
    entities: [
      { name: 'Artificial Intelligence', type: 'FIELD', paragraphIndex: 0, mentions: 12 },
      { name: 'Machine Learning', type: 'FIELD', paragraphIndex: 1, mentions: 8 },
      { name: 'Deep Learning', type: 'FIELD', paragraphIndex: 2, mentions: 5 },
      { name: 'Natural Language Processing', type: 'FIELD', paragraphIndex: 3, mentions: 3 },
      { name: 'Computer Vision', type: 'FIELD', paragraphIndex: 4, mentions: 2 },
    ],
    timeline: [
      {
        date: '1950',
        description: 'Alan Turing proposes the Turing Test for machine intelligence',
        paragraphIndex: 0,
        significance: 'Foundational',
      },
      {
        date: '1956',
        description: 'The term "Artificial Intelligence" is coined at the Dartmouth Conference',
        paragraphIndex: 1,
        significance: 'Origin',
      },
      {
        date: '2012',
        description: 'AlexNet wins ImageNet, sparking the modern AI boom',
        paragraphIndex: 2,
        significance: 'Modern breakthrough',
      },
    ],
    concepts: [
      {
        term: 'Intelligent Agent',
        definition: 'A system that perceives its environment and acts to achieve goals',
        paragraphIndex: 0,
      },
      {
        term: 'Machine Learning',
        definition: 'Algorithms that improve through experience',
        paragraphIndex: 1,
      },
      {
        term: 'Neural Network',
        definition: 'Computing systems inspired by biological neural networks',
        paragraphIndex: 2,
      },
    ],
    tags: [
      'artificial intelligence',
      'machine learning',
      'deep learning',
      'natural language processing',
    ],
    images: [],
    videos: [],
    status: 'ready',
    starred: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    documentType: 'article',
    readingTimeMinutes: 6,
    qualityScore: 92,
    diagramCount: 2,
    imageCount: 3,
    hasToc: true,
    hasNumbering: false,
  };
}

function CurrentStepContent({
  captureInfo,
  onDemoComplete,
}: {
  captureInfo: { title: string; url: string } | null;
  onDemoComplete: () => void;
}) {
  const { config, updateConfig } = useData();
  const onboarding = useOnboarding();
  let currentStep = 1;
  try {
    currentStep = onboarding.currentStep;
  } catch {
    /* ignore */
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <Onboarding.Step step={1}>
          <WelcomeHero />
        </Onboarding.Step>

        <Onboarding.Step step={2}>
          <ApiSetup
            selectedProvider={config.provider?.id || ''}
            apiKey={config.apiKey}
            chatModel={config.chatModel}
            onProviderChange={(id) => {
              const p = PRESETS.find((pr) => pr.id === id);
              updateConfig({
                provider: p
                  ? { id: p.id, label: p.label, keyUrl: p.keyUrl, keyHint: p.keyHint }
                  : null,
                chatModel: p?.defaultModel || '',
              });
            }}
            onApiKeyChange={(key) => updateConfig({ apiKey: key })}
            onModelChange={(model) => updateConfig({ chatModel: model })}
          />
        </Onboarding.Step>

        <Onboarding.Step step={3}>
          <PersonalizeStep
            config={{
              theme: config.theme,
              accentColor: config.accentColor,
              fontFamily: config.fontFamily,
              fontSize: config.fontSize,
            }}
            onChange={(patch) => updateConfig(patch)}
          />
        </Onboarding.Step>

        <Onboarding.Step step={4}>
          <PermissionCard />
        </Onboarding.Step>

        <Onboarding.Step step={5}>
          <DemoVideo onComplete={onDemoComplete} />
        </Onboarding.Step>

        <Onboarding.Step step={6}>
          <SuccessScreen captureInfo={captureInfo} />
        </Onboarding.Step>
      </motion.div>
    </AnimatePresence>
  );
}

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [config, setConfig] = useState<OnboardingConfig>({
    provider: null,
    apiKey: '',
    chatModel: '',
    theme: 'dark',
    accentColor: '#0a84ff',
    fontFamily: 'sans',
    fontSize: 'md',
  });
  const [captureInfo, setCaptureInfo] = useState<{ title: string; url: string } | null>(null);
  const demoCreated = useRef(false);

  const updateConfig = useCallback((patch: Partial<OnboardingConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleDemoComplete = useCallback(async () => {
    if (demoCreated.current) return;
    demoCreated.current = true;

    try {
      const doc = demoDocument();
      await saveDocument(doc);
      setCaptureInfo({ title: doc.title, url: doc.url });
      log.info('ONBOARDING', 'Demo document saved to library', { id: doc.id, title: doc.title });
    } catch (err) {
      log.error('ONBOARDING', 'Failed to save demo document', err);
    }
  }, []);

  const handleComplete = useCallback(async () => {
    try {
      // Save provider if configured
      const preset = config.provider?.id ? PRESETS.find((p) => p.id === config.provider!.id) : null;
      if (preset && config.apiKey.trim()) {
        const providerCfg: ProviderConfig = {
          id: crypto.randomUUID(),
          label: preset.label,
          protocol: preset.protocol,
          baseUrl: preset.baseUrl,
          apiKey: config.apiKey.trim(),
          extraHeaders: {},
          chatModel: config.chatModel || preset.defaultModel,
          embeddingModel: config.chatModel || preset.defaultModel,
          embeddingDimensions: 768,
          enabled: true,
        };
        await saveProvider(providerCfg);

        const current = await getSettings();
        await saveSettings({
          ...current,
          runtime: {
            ...current.runtime,
            chat: {
              providerId: providerCfg.id,
              modeModels: {
                FAST: providerCfg.chatModel,
                BALANCED: providerCfg.chatModel,
                DEEP: providerCfg.chatModel,
              },
            },
            embedding: {
              providerId: providerCfg.id,
              model: providerCfg.embeddingModel,
              dimensions: providerCfg.embeddingDimensions,
              version: current.runtime.embedding.version,
            },
          },
        });
      }

      // Save appearance
      const appearance = await getAppearance();
      await saveAppearance({
        ...appearance,
        theme: config.theme,
        accentColor: config.accentColor,
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
      });
      applyAppearance({
        theme: config.theme,
        accentColor: config.accentColor,
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
      });

      log.info('ONBOARDING', 'Onboarding completed with config', {
        provider: config.provider?.id,
        theme: config.theme,
      });

      await browser.storage.local.set({ 'notch:onboarded': true });
      onComplete();
    } catch (err) {
      log.error('ONBOARDING', 'Failed to save onboarding config', err);
      await browser.storage.local.set({ 'notch:onboarded': true });
      onComplete();
    }
  }, [config, onComplete]);

  const data = useMemo<OnboardingData>(() => ({ config, updateConfig }), [config, updateConfig]);

  return (
    <div className="min-h-screen bg-canvas-soft text-ink flex flex-col relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <OnboardingDataContext.Provider value={data}>
        <Onboarding
          totalSteps={6}
          onComplete={() => {
            handleComplete().catch(() => {});
          }}
          defaultValue={1}
          className="flex-1 flex flex-col bg-transparent border-none shadow-none p-0"
        >
          <header className="shrink-0 pt-8 pb-4 px-6">
            <div className="max-w-lg mx-auto flex flex-col items-center gap-3">
              <ProgressHeader />
              <CurrentStepIndicator />
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center px-6 pb-4">
            <div className="w-full max-w-2xl">
              <CurrentStepContent
                captureInfo={captureInfo}
                onDemoComplete={() => {
                  handleDemoComplete().catch(() => {});
                }}
              />
            </div>
          </main>

          <footer className="shrink-0 pb-8 pt-4 px-6">
            <NavigationFooter />
          </footer>
        </Onboarding>
      </OnboardingDataContext.Provider>
    </div>
  );
}
