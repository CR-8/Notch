import { browser } from 'wxt/browser';
import type { KokoroTTS, GenerateOptions } from 'kokoro-js';

export const TTS_MODEL_ID = 'kokoro-tts';
export const TTS_MODEL_HF = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const TTS_SAMPLE_RATE = 24000;

export function getTtsModelDef() {
  return {
    id: TTS_MODEL_ID,
    hfId: TTS_MODEL_HF,
    label: 'Kokoro TTS',
    description:
      'High-quality neural TTS with 82M params. Supports multiple voices and streaming playback.',
    sizeLabel: '~92 MB',
    sizeMB: 92,
    capability: 'tts',
    backend: 'wasm',
    isDefault: true,
  } as const;
}

const STORAGE_KEY = 'notch:tts';

export type TtsStatus = 'not-installed' | 'downloading' | 'ready' | 'error';
export type TtsPlayState = 'idle' | 'synthesizing' | 'playing';

export interface TtsConfig {
  status: TtsStatus;
  progress: number;
}

async function getTtsConfig(): Promise<TtsConfig> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (
    (result[STORAGE_KEY] as TtsConfig) ?? { status: 'not-installed' as TtsStatus, progress: 0 }
  );
}

async function saveTtsConfig(cfg: TtsConfig): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: cfg });
}

export async function getTtsStatus(): Promise<TtsStatus> {
  const cfg = await getTtsConfig();
  return cfg.status;
}

export async function setTtsStatus(status: TtsStatus, progress = 0): Promise<void> {
  await saveTtsConfig({ status, progress });
}

let _kokoroTts: KokoroTTS | null = null;

export async function downloadTtsModel(onProgress?: (pct: number) => void): Promise<void> {
  await setTtsStatus('downloading', 0);
  onProgress?.(0);
  try {
    const mod = await import('kokoro-js');
    mod.env.wasmPaths = (browser.runtime as { getURL(path: string): string }).getURL('/ort/');
    _kokoroTts = await mod.KokoroTTS.from_pretrained(TTS_MODEL_HF, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress' && typeof p.progress === 'number') {
          const pct = Math.round(p.progress);
          onProgress?.(pct);
          setTtsStatus('downloading', pct).catch(() => {});
        }
      },
    });
    await setTtsStatus('ready', 100);
    onProgress?.(100);
  } catch (err) {
    _kokoroTts = null;
    await setTtsStatus('error', 0);
    throw err;
  }
}

export async function ensurePipeline(): Promise<void> {
  if (_kokoroTts) return;
  const cfg = await getTtsConfig();
  if (cfg.status !== 'ready') throw new Error('TTS model not downloaded');
  const mod = await import('kokoro-js');
  mod.env.wasmPaths = (browser.runtime as { getURL(path: string): string }).getURL('/ort/');
  _kokoroTts = await mod.KokoroTTS.from_pretrained(TTS_MODEL_HF, {
    dtype: 'q8',
    device: 'wasm',
  });
}

export async function synthesize(text: string): Promise<Uint8Array> {
  if (!_kokoroTts) await ensurePipeline();
  const raw = await _kokoroTts!.generate(text, { voice: 'af_heart' });
  return wavEncode(raw.audio, raw.sampling_rate);
}

export async function synthesizeRaw(
  text: string,
  voice: GenerateOptions['voice'] = 'af_heart',
): Promise<Float32Array> {
  if (!_kokoroTts) await ensurePipeline();
  const raw = await _kokoroTts!.generate(text, { voice });
  return raw.audio;
}

export async function createStream(
  text: string,
  voice: GenerateOptions['voice'] = 'af_heart',
): Promise<AsyncGenerator<{ audio: Float32Array; sampleRate: number }, void, void>> {
  if (!_kokoroTts) await ensurePipeline();
  return _kokoroTts!.stream(text, { voice }) as unknown as AsyncGenerator<
    { audio: Float32Array; sampleRate: number },
    void,
    void
  >;
}

export function wavEncode(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}
