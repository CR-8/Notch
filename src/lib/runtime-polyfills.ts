let applied = false;

type PromiseResolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export function ensureRuntimePolyfills(): void {
  if (applied) return;
  applied = true;

  const p = Promise as PromiseConstructor & {
    withResolvers?: <T>() => PromiseResolvers<T>;
  };

  if (typeof p.withResolvers !== 'function') {
    p.withResolvers = <T>(): PromiseResolvers<T> => {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  const urlCtor = URL as unknown as {
    parse?: (input: string, base?: string | URL) => URL | null;
  };

  if (typeof urlCtor.parse !== 'function') {
    urlCtor.parse = (input: string, base?: string | URL) => {
      try {
        return base ? new URL(input, base) : new URL(input);
      } catch {
        return null;
      }
    };
  }
}
