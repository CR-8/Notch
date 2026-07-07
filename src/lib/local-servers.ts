/**
 * SRV-1..4: Local AI server auto-detection.
 *
 * Probes the well-known local ports for Ollama, LM Studio, and llama.cpp,
 * then fetches the model list from the first live server. Returns structured
 * results so the options page can offer one-click "use this server" presets.
 */

export interface LocalServer {
  label: string;
  baseUrl: string;
  modelsEndpoint: string;
  kind: 'ollama' | 'lmstudio' | 'llamacpp' | 'generic';
}

export interface LocalServerResult extends LocalServer {
  online: boolean;
  models: string[];
  error?: string;
  latencyMs: number;
}

/** Well-known local AI server endpoints to probe. */
const CANDIDATES: LocalServer[] = [
  {
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    modelsEndpoint: 'http://localhost:11434/api/tags',
    kind: 'ollama',
  },
  {
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    modelsEndpoint: 'http://localhost:1234/v1/models',
    kind: 'lmstudio',
  },
  {
    label: 'llama.cpp',
    baseUrl: 'http://localhost:8080/v1',
    modelsEndpoint: 'http://localhost:8080/v1/models',
    kind: 'llamacpp',
  },
  {
    label: 'Jan',
    baseUrl: 'http://localhost:1337/v1',
    modelsEndpoint: 'http://localhost:1337/v1/models',
    kind: 'generic',
  },
];

const PROBE_TIMEOUT_MS = 2000;

/**
 * Probe a single server candidate.
 * Returns a result with `online=false` on any network/timeout error.
 */
async function probeServer(
  candidate: LocalServer,
  signal: AbortSignal,
): Promise<LocalServerResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(candidate.modelsEndpoint, {
      method: 'GET',
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return {
        ...candidate,
        online: false,
        models: [],
        error: `HTTP ${res.status}`,
        latencyMs: Date.now() - t0,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    let models: string[] = [];

    if (candidate.kind === 'ollama') {
      // Ollama: { models: [{ name: string, ... }] }
      const list = (data.models ?? []) as Array<{ name?: string }>;
      models = list.map((m) => m.name ?? '').filter(Boolean);
    } else {
      // OpenAI-compatible: { data: [{ id: string, ... }] }
      const list = (data.data ?? []) as Array<{ id?: string }>;
      models = list.map((m) => m.id ?? '').filter(Boolean);
    }

    return { ...candidate, online: true, models, latencyMs: Date.now() - t0 };
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || signal.aborted);
    return {
      ...candidate,
      online: false,
      models: [],
      error: isAbort ? 'timeout' : err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - t0,
    };
  }
}

/**
 * Probe all known local server candidates concurrently.
 * Each probe has its own timeout so one slow server doesn't block the rest.
 * Resolves when all probes have completed (or timed out).
 */
export async function detectLocalServers(): Promise<LocalServerResult[]> {
  const results = await Promise.all(
    CANDIDATES.map((candidate) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      return probeServer(candidate, ctrl.signal).finally(() => clearTimeout(timer));
    }),
  );
  return results;
}

/** Return only the servers that responded successfully. */
export function getOnlineServers(results: LocalServerResult[]): LocalServerResult[] {
  return results.filter((r) => r.online);
}
