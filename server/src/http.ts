import { config } from './config';

export class UpstreamError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

/** fetch with timeout + a polite User-Agent. Throws UpstreamError on non-2xx. */
export async function fetchText(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<string> {
  if (config.dataMode === 'demo') throw new UpstreamError('demo mode: upstream disabled');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': config.userAgent, Accept: '*/*', ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new UpstreamError(`${res.status} from ${new URL(url).host}`, res.status);
    return await res.text();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(`${new URL(url).host}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const text = await fetchText(url, { ...init, headers: { Accept: 'application/json', ...(init.headers ?? {}) } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(`invalid JSON from ${new URL(url).host}`);
  }
}
