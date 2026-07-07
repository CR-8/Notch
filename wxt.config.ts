import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      fs: {
        allow: [__dirname],
        strict: false,
      },
    },
    build: {
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 1500,
    },
    optimizeDeps: {
      exclude: ['mermaid'],
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
    // WXT auto-relaxes CSP in dev mode to allow the Vite dev server.
    // No manual extension_pages override needed — it will be set by WXT's
    // addDevModeCsp when running `wxt serve`/`wxt -b firefox`.
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    browser_specific_settings: {
      gecko: {
        id: 'notch@notch-extension',
        strict_min_version: '109.0',
        data_collection_permissions: {
          required: ['websiteContent'],
          optional: [],
        },
      },
    },
  }),
});
