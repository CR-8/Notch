/**
 * Copy ONNX Runtime Web's WASM backend into public/ort/ so the on-device
 * models load entirely from the extension's own origin.
 *
 * Why: transformers.js / onnxruntime-web load their WASM glue (`*.mjs`) via a
 * dynamic import that defaults to the jsdelivr CDN. MV3's `script-src 'self'`
 * CSP blocks that (and MV3 forbids remote code), so we ship the runtime locally
 * and point transformers.js at it via `env.backends.onnx.wasm.wasmPaths`
 * (see src/lib/on-device.ts).
 *
 * Vite serves files in the public dir verbatim (no bundling/parsing), which is
 * the reliable way to ship these large binaries. The files live in node_modules
 * and are copied here at predev/prebuild time, so they never bloat git
 * (public/ort/ is gitignored).
 *
 *   asyncify.* → WASM CPU path (embeddings + small chat models)
 *   jsep.*     → WebGPU path (Phi-3 / TinyLlama)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FILES = [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
];

function resolveDist() {
  const candidates = [
    path.join(root, 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist'),
    path.join(root, 'node_modules/onnxruntime-web/dist'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

const dist = resolveDist();
if (!dist) {
  console.warn('[copy-ort] onnxruntime-web dist not found — skipping. On-device models will fail until `npm install` runs.');
  process.exit(0);
}

// WXT's public dir is the project-root `public/` (same place icons/ live), NOT
// src/public — files written anywhere else never make it into the build output,
// which would 404 on-device wasm at runtime (wasmPaths='/ort/' in on-device.ts).
const destDir = path.join(root, 'public/ort');
fs.mkdirSync(destDir, { recursive: true });

let copied = 0;
for (const file of FILES) {
  const src = path.join(dist, file);
  const dest = path.join(destDir, file);
  if (!fs.existsSync(src)) {
    console.warn(`[copy-ort] missing source: ${file}`);
    continue;
  }
  // Skip if already present and same size (fast no-op on repeat runs).
  if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) {
    copied++;
    continue;
  }
  fs.copyFileSync(src, dest);
  copied++;
}

console.log(`[copy-ort] ${copied}/${FILES.length} ORT runtime files ready in public/ort/`);
