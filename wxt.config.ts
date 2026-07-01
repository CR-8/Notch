import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  hooks: {
    // ── Firefox MV2: module background page ──────────────────────────────────
    // WXT deletes the background `type: 'module'` for MV2 (manifest.mjs), so the
    // background is bundled as a single IIFE and every dynamic import() —
    // @huggingface/transformers, kokoro-js and their base64 wasm — gets inlined,
    // producing a ~116MB background.js. We re-inject the module type after WXT
    // strips it (so grouping builds the background as code-split ESM), then point
    // the manifest at a module background *page* that Firefox can load as ESM.
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.browser !== 'firefox') return;
      const bg = entrypoints.find((e) => e.type === 'background');
      if (bg) (bg.options as { type?: string }).type = 'module';
    },
    'build:manifestGenerated': (wxt, manifest) => {
      if (wxt.config.browser !== 'firefox') return;
      (manifest as { background?: unknown }).background = { page: 'background.html' };
    },
    'build:done': async (wxt) => {
      if (wxt.config.browser !== 'firefox') return;
      const fs = await import('node:fs/promises');
      const html =
        '<!doctype html><html><head><meta charset="utf-8"></head>' +
        '<body><script type="module" src="./background.js"></script></body></html>';
      await fs.writeFile(path.resolve(wxt.config.outDir, 'background.html'), html, 'utf8');
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 1500,
    },
    optimizeDeps: {
      exclude: ['@huggingface/transformers', 'mermaid'],
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
      page: 'settings.html',
      open_in_tab: true,
    },
    permissions:
      browser === 'firefox'
        ? ['storage', 'tabs', 'activeTab']
        : ['storage', 'tabs', 'activeTab', 'scripting', 'contextMenus'],
    // debugger + downloads are only used for one-click PDF export. They are
    // requested at runtime (inside the export click) so a fresh install does
    // not front-load these powerful permissions. Firefox uses the print-dialog
    // fallback and needs neither.
    ...(browser === 'firefox' ? {} : { optional_permissions: ['debugger', 'downloads'] }),
    host_permissions: ['*://*/*'],
    commands: {
      'capture-page': {
        suggested_key: {
          default: 'Alt+Shift+C',
          mac: 'Command+Shift+C',
        },
        description: 'Capture this page with Notch',
      },
    },
    // No sandboxed pages are declared (no `sandbox.pages`), so a sandbox CSP
    // with 'unsafe-eval'/'unsafe-inline' would be dead config and a needless
    // review flag. Only the strict extension-pages policy is set.
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    browser_specific_settings: {
      gecko: {
        id: 'notch@notch-extension',
        strict_min_version: '109.0',
      },
    },
  }),
});
