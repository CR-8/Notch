import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      // Exclude @huggingface/transformers from pre-bundling — it uses dynamic imports
      // and WASM that must be loaded at runtime, not bundled by Vite.
      exclude: ['@huggingface/transformers'],
    },
  }),
  manifest: ({ browser }) => ({
    name: 'Notch',
    description: 'Capture, structure, and interrogate web content with your own AI key.',
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    permissions: ['storage', 'tabs', 'activeTab'],
    // wasm-unsafe-eval is required by @xenova/transformers (ONNX Runtime WASM backend).
    // MV3 (Chrome) uses extension_pages; MV2 (Firefox) uses the top-level key.
    ...(browser === 'firefox'
      ? {
          // Firefox MV2 CSP — must allow wasm-unsafe-eval for ONNX WASM
          content_security_policy: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
          browser_specific_settings: {
            gecko: {
              id: 'notch@notch-extension',
              strict_min_version: '109.0',
            },
          },
        }
      : {
          // Chrome MV3 CSP
          content_security_policy: {
            extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
          },
        }),
  }),
});
