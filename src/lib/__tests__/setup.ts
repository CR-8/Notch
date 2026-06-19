// Vitest global setup. The core unit tests target pure functions and need no
// browser globals; this file exists so vitest's setupFiles reference resolves.
// Node 20+ provides globalThis.crypto (used by the chunker) out of the box.
export {};
