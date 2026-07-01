/**
 * PATH-2 / MODEL-1..7: On-device AI via @huggingface/transformers
 *
 * Provides:
 *  - A curated LOCAL_MODELS catalog of models that work in a Chrome extension
 *    (WebGPU-accelerated chat + CPU embedding)
 *  - Download/status tracking persisted in browser.storage.local
 *  - An embedding function that falls back to the HuggingFace MiniLM model
 *  - A chat generation function for local LLM inference
 *
 * Models run inside the background service worker (MV3) — @huggingface/transformers
 * supports this context since v3.x with its web-compatible backends.
 *
 * IMPORTANT: Large generative models (Phi-3, TinyLlama) require WebGPU.
 * MiniLM for embeddings runs on CPU/WASM and is always available.
 */

import { browser } from 'wxt/browser';
import type { FeatureExtractionPipeline, TextGenerationPipeline } from '@huggingface/transformers';

// ── ONNX Runtime backend wiring ───────────────────────────────────────────────

interface TransformersEnv {
  backends: {
    onnx?: {
      wasm?: {
        wasmPaths?: string | { wasm?: string | URL; mjs?: string | URL };
        numThreads?: number;
      };
    };
  };
  allowRemoteModels: boolean;
  allowLocalModels: boolean;
}

const getRuntimeURL = (path: string): string =>
  (browser.runtime.getURL as unknown as (path: string) => string)(path);

/**
 * Point ONNX Runtime at the WASM backend we ship inside the extension (`/ort/`)
 * instead of the jsdelivr CDN.
 *
 * transformers.js / onnxruntime-web load their WASM glue (`*.mjs`) via a
 * dynamic `import()`. By default that URL points at jsdelivr, which MV3's
 * `script-src 'self'` CSP blocks (and MV3 forbids remote code anyway). Setting
 * `wasmPaths` to our own origin makes the import resolve locally. The `/ort/`
 * files are copied from onnxruntime-web at build time — see wxt.config.ts
 * (`build:publicAssets`).
 */
function configureEnv(env: TransformersEnv): void {
  try {
    const wasm = env.backends.onnx?.wasm;
    if (wasm) {
      wasm.wasmPaths = getRuntimeURL('/ort/');
      // Extension worker contexts aren't cross-origin isolated, so
      // SharedArrayBuffer (multi-threaded WASM) is unavailable — run 1 thread.
      wasm.numThreads = 1;
    }
  } catch {
    /* best-effort: backend shape varies across transformers versions */
  }
  // Model weights still download from the HuggingFace Hub into the cache.
  env.allowRemoteModels = true;
  env.allowLocalModels = false;
}

// ── Model catalog ─────────────────────────────────────────────────────────────

export type ModelCapability = 'embedding' | 'chat' | 'both' | 'tts';
export type ModelBackend = 'wasm' | 'webgpu';

export interface LocalModelDef {
  id: string;
  hfId: string; // HuggingFace model id
  label: string;
  description: string;
  sizeLabel: string; // human-readable size ("~90 MB")
  sizeMB: number;
  capability: ModelCapability;
  backend: ModelBackend;
  isDefault: boolean;
  /** For embedding models: output vector dimensions */
  embeddingDimensions?: number;
}

/**
 * Curated list of models that work in Chrome extensions.
 * Ordered from smallest to largest.
 */
export const LOCAL_MODELS: LocalModelDef[] = [
  {
    id: 'minilm-l6',
    hfId: 'Xenova/all-MiniLM-L6-v2',
    label: 'MiniLM-L6 (Embeddings)',
    description: 'Fast 90 MB sentence embedding model. Powers semantic search and related notes.',
    sizeLabel: '~90 MB',
    sizeMB: 90,
    capability: 'embedding',
    backend: 'wasm',
    isDefault: true,
    embeddingDimensions: 384,
  },
  {
    id: 'minilm-l12',
    hfId: 'Xenova/all-MiniLM-L12-v2',
    label: 'MiniLM-L12 (Embeddings)',
    description: 'Higher-quality embeddings at ~130 MB. Better semantic matching.',
    sizeLabel: '~130 MB',
    sizeMB: 130,
    capability: 'embedding',
    backend: 'wasm',
    isDefault: false,
    embeddingDimensions: 384,
  },
  {
    id: 'smollm2-135m',
    hfId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    label: 'SmolLM2-135M (Chat)',
    description:
      'Tiny 270 MB chat model. Minimal quality but fully offline. Good for quick summaries.',
    sizeLabel: '~270 MB',
    sizeMB: 270,
    capability: 'chat',
    backend: 'wasm',
    isDefault: true,
  },
  {
    id: 'phi3-mini',
    hfId: 'microsoft/Phi-3-mini-4k-instruct',
    label: 'Phi-3 Mini (Chat, WebGPU)',
    description:
      'High-quality 2.4 GB chat model. Requires WebGPU (Chrome 113+). Matches GPT-3.5 on many tasks.',
    sizeLabel: '~2.4 GB',
    sizeMB: 2400,
    capability: 'chat',
    backend: 'webgpu',
    isDefault: false,
  },
  {
    id: 'tinyllama',
    hfId: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
    label: 'TinyLlama 1.1B (Chat, WebGPU)',
    description: 'Well-rounded 2.2 GB chat model. WebGPU only. Good balance of size and quality.',
    sizeLabel: '~2.2 GB',
    sizeMB: 2200,
    capability: 'chat',
    backend: 'webgpu',
    isDefault: false,
  },
  {
    id: 'kokoro-tts',
    hfId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    label: 'Kokoro TTS',
    description:
      'High-quality neural TTS with 82M params. Supports multiple voices with natural intonation.',
    sizeLabel: '~92 MB',
    sizeMB: 92,
    capability: 'tts',
    backend: 'wasm',
    isDefault: true,
  },
];

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'notch:ondevice';

export type ModelStatus = 'not-installed' | 'downloading' | 'ready' | 'error';

export interface OnDeviceConfig {
  /** Installed embedding model id (from LOCAL_MODELS) */
  embeddingModelId: string | null;
  /** Installed chat model id (from LOCAL_MODELS) */
  chatModelId: string | null;
  /** Per-model status */
  status: Record<string, ModelStatus>;
  /** Per-model download progress 0..100 */
  progress: Record<string, number>;
  /** Whether on-device inference is the preferred path */
  enabled: boolean;
}

const DEFAULT_CONFIG: OnDeviceConfig = {
  embeddingModelId: null,
  chatModelId: null,
  status: {},
  progress: {},
  enabled: false,
};

export async function getOnDeviceConfig(): Promise<OnDeviceConfig> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as OnDeviceConfig) ?? DEFAULT_CONFIG;
}

export async function saveOnDeviceConfig(cfg: OnDeviceConfig): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: cfg });
}

export async function setModelStatus(
  modelId: string,
  status: ModelStatus,
  progress = 0,
): Promise<void> {
  const cfg = await getOnDeviceConfig();
  cfg.status[modelId] = status;
  cfg.progress[modelId] = progress;
  await saveOnDeviceConfig(cfg);
}

// ── WebGPU capability check ──────────────────────────────────────────────────

export async function hasWebGPU(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
    const adapter = await (
      navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }
    ).gpu.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

// ── Download a model (runs in background) ────────────────────────────────────

/**
 * Download and cache a model from HuggingFace Hub.
 * Uses @huggingface/transformers pipeline to pre-warm the model cache.
 * Progress is reported via onProgress callback and persisted to storage.
 *
 * @param modelId  ID from LOCAL_MODELS catalog
 * @param onProgress  called with 0..100 as files download
 */
export async function downloadModel(
  modelId: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const def = LOCAL_MODELS.find((m) => m.id === modelId);
  if (!def) throw new Error(`Unknown local model: ${modelId}`);

  await setModelStatus(modelId, 'downloading', 0);
  onProgress?.(0);

  try {
    // Dynamically import to avoid loading transformers in all contexts
    const { pipeline, env } = await import('@huggingface/transformers');

    // Load WASM backend locally; allow model weights to download from HF Hub.
    configureEnv(env);

    const progressCallback = (p: { status: string; progress?: number }): void => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        const pct = Math.round(p.progress);
        onProgress?.(pct);
        setModelStatus(modelId, 'downloading', pct).catch(() => {});
      }
    };

    if (def.capability === 'embedding') {
      await pipeline('feature-extraction', def.hfId, {
        progress_callback: progressCallback,
        revision: 'main',
      });
    } else if (def.capability === 'tts') {
      const mod = await import('kokoro-js');
      mod.env.wasmPaths = getRuntimeURL('/ort/');
      await mod.KokoroTTS.from_pretrained(def.hfId, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: progressCallback,
      });
    } else {
      await pipeline('text-generation', def.hfId, {
        progress_callback: progressCallback,
        revision: 'main',
      });
    }

    await setModelStatus(modelId, 'ready', 100);
    onProgress?.(100);
  } catch (err) {
    await setModelStatus(modelId, 'error', 0);
    throw err;
  }
}

// ── On-device embedding ───────────────────────────────────────────────────────

let _embeddingPipeline: FeatureExtractionPipeline | null = null;
let _embeddingModelId: string | null = null;

/**
 * PATH-2: Compute embeddings locally using the installed MiniLM model.
 * Returns float32 arrays of length embeddingDimensions (384 for MiniLM-L6).
 */
export async function embedOnDevice(texts: string[], modelId?: string): Promise<number[][]> {
  const { pipeline, env } = await import('@huggingface/transformers');
  configureEnv(env);

  const cfg = await getOnDeviceConfig();
  const resolvedId = modelId ?? cfg.embeddingModelId ?? 'minilm-l6';
  const def = LOCAL_MODELS.find((m) => m.id === resolvedId);
  if (!def) throw new Error(`On-device embedding model not configured`);

  if (!_embeddingPipeline || _embeddingModelId !== resolvedId) {
    _embeddingPipeline = await pipeline('feature-extraction', def.hfId, { revision: 'main' });
    _embeddingModelId = resolvedId;
  }

  const results: number[][] = [];
  for (const text of texts) {
    const output = await _embeddingPipeline(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array of length 384
    results.push(Array.from(output.data as Float32Array));
  }
  return results;
}

// ── On-device chat generation ────────────────────────────────────────────────

let _chatPipeline: TextGenerationPipeline | null = null;
let _chatModelId: string | null = null;

/**
 * PATH-3/MODEL: Generate text using the installed local chat model.
 * Yields text chunks as they are generated (streaming via transformers).
 */
export async function* generateOnDevice(
  systemPrompt: string,
  userMessage: string,
  modelId?: string,
): AsyncGenerator<string> {
  const { pipeline, env, TextStreamer } = await import('@huggingface/transformers');
  configureEnv(env);

  const cfg = await getOnDeviceConfig();
  const resolvedId = modelId ?? cfg.chatModelId ?? 'smollm2-135m';
  const def = LOCAL_MODELS.find((m) => m.id === resolvedId);
  if (!def) throw new Error(`On-device chat model not configured`);

  if (!_chatPipeline || _chatModelId !== resolvedId) {
    _chatPipeline = await pipeline('text-generation', def.hfId, { revision: 'main' });
    _chatModelId = resolvedId;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let buffer = '';
  const streamer = new TextStreamer(_chatPipeline.tokenizer, {
    skip_prompt: true,
    callback_function: (text: string) => {
      buffer += text;
    },
  });

  await _chatPipeline(messages, {
    max_new_tokens: 1024,
    streamer,
    do_sample: true,
    temperature: 0.7,
  });

  // Yield the full response (streaming isn't perfectly async in transformers.js yet)
  if (buffer) yield buffer;
}
