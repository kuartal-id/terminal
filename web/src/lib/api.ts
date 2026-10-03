import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, Envelope } from '@shared/types';

export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: ApiError['code'],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let body: Partial<ApiError> = {};
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    throw new ApiFailure(body.error ?? `Request failed (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

export interface UseApi<T> {
  data: T | undefined;
  error: ApiFailure | undefined;
  loading: boolean;
  reload: () => void;
}

/**
 * Fetch an endpoint, optionally re-polling every `refreshMs` while the tab is
 * visible. Keeps the previous data on screen while refreshing.
 */
export function useApi<T>(path: string | null, refreshMs = 0): UseApi<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiFailure>();
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!path) return;
    if (lastPath.current !== path) {
      lastPath.current = path;
      setData(undefined);
    }
    const ctrl = new AbortController();
    setLoading(true);
    api<T>(path, ctrl.signal)
      .then((d) => {
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        setError(e instanceof ApiFailure ? e : new ApiFailure((e as Error).message, 0));
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [path, tick]);

  useEffect(() => {
    if (!path || !refreshMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1);
    }, refreshMs);
    return () => clearInterval(id);
  }, [path, refreshMs]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export type EnvelopeOf<T> = Envelope<T>;
