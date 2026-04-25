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
    permissions: browser === 'firefox'
      ? ['storage', 'tabs', 'activeTab']
      : ['storage', 'tabs', 'activeTab', 'scripting'],
    // wasm-unsafe-eval is required by ONNX Runtime WASM backend.
    // The ONNX .wasm + .mjs files are bundled locally in public/ort/ so no
    // CDN fetches are needed — both Chrome and Firefox serve them as 'self'.
    ...(browser === 'firefox'
      ? {
          // Firefox MV2 CSP
          content_security_policy: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
          // Make the bundled ONNX runtime files accessible to the background script
          web_accessible_resources: ['ort/*'],
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
          web_accessible_resources: [{ resources: ['ort/*'], matches: ['<all_urls>'] }],
        }),
  }),
});
