/**
 * Vitest setup file — mocks wxt/browser so storage.ts works in the node test environment.
 * The mock delegates to the same global.chrome mock that individual test files set up.
 */
import { vi } from 'vitest';

// Mock wxt/browser to proxy through to global.chrome (set up per-test)
vi.mock('wxt/browser', () => ({
  browser: new Proxy({} as typeof chrome, {
    get(_target, prop: string) {
      const c = (globalThis as any).chrome;
      if (!c) return undefined;
      const val = (c as any)[prop];
      return typeof val === 'function' ? val.bind(c) : val;
    },
  }),
}));
