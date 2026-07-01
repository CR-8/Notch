import { browser } from 'wxt/browser';
import { log } from '@/lib/logger';

/**
 * Centralized in-app navigation for Notch's standalone pages.
 *
 * The settings experience is a normal standalone page (`settings.html`) opened
 * in a regular browser tab — NOT the browser's built-in extension "options"
 * surface (`runtime.openOptionsPage()`), which renders inside the add-on
 * manager chrome and varies by browser. Routing everything through these
 * helpers keeps the behavior predictable and avoids spawning duplicate tabs.
 */

export function settingsUrl(): string {
  return browser.runtime.getURL('/settings.html');
}

export function libraryUrl(): string {
  return browser.runtime.getURL('/newtab.html');
}

/** Focus an already-open page matching `url`, or open it in a new tab. */
async function focusOrCreate(url: string): Promise<void> {
  try {
    const tabs = await browser.tabs.query({});
    const targetPath = new URL(url).pathname;
    const existing = tabs.find((t) => {
      if (!t.url) return false;
      try {
        const tPath = new URL(t.url).pathname;
        // Normalize double slashes and match
        return (
          tPath === targetPath || tPath.replace(/\/+/g, '/') === targetPath.replace(/\/+/g, '/')
        );
      } catch {
        return t.url.endsWith(targetPath);
      }
    });
    if (existing?.id != null) {
      await browser.tabs.update(existing.id, { active: true });
      if (existing.windowId != null) {
        try {
          await browser.windows.update(existing.windowId, { focused: true });
        } catch {
          /* windows API optional */
        }
      }
      return;
    }
  } catch (err) {
    log.error('NAVIGATION', 'focusOrCreate error', err);
  }
  await browser.tabs.create({ url });
}

/** Open the standalone settings page, reusing an existing settings tab if present. */
export function openSettings(): Promise<void> {
  return focusOrCreate(settingsUrl());
}

/** Navigate the CURRENT tab back to the library (used by in-tab "Back" actions). */
export function goToLibrary(): void {
  window.location.href = libraryUrl();
}
