import { useEffect, useRef, useState } from 'react';

/**
 * Live crypto data straight from Binance's public websocket in the browser.
 * Costs nothing and puts zero load on our server. If the socket is blocked
 * (some networks/regions), callers fall back to REST polling via /api/quotes.
 */

const WS_HOSTS = ['wss://data-stream.binance.vision/stream', 'wss://stream.binance.com:9443/stream'];

export interface MiniTicker {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  quoteVolume: number;
  changePct: number;
}

function openStream(streams: string[], onMsg: (data: unknown) => void, onState: (ok: boolean) => void): () => void {
  let closed = false;
  let hostIdx = 0;
  let ws: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;

  const connect = () => {
    if (closed) return;
    try {
      ws = new WebSocket(`${WS_HOSTS[hostIdx]}?streams=${streams.join('/')}`);
    } catch {
      onState(false);
      return;
    }
    ws.onopen = () => {
      attempts = 0;
      onState(true);
    };
    ws.onmessage = (ev) => {
      try {
        onMsg(JSON.parse(ev.data as string).data);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      onState(false);
      if (closed) return;
      attempts++;
      hostIdx = (hostIdx + 1) % WS_HOSTS.length;
      retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts, 5)));
    };
    ws.onerror = () => ws?.close();
  };
  connect();
  return () => {
    closed = true;
    clearTimeout(retry);
    ws?.close();
  };
}

export function useMiniTickers(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, MiniTicker>>({});
  const [connected, setConnected] = useState(false);
  const key = symbols.join(',');
  useEffect(() => {
    if (!symbols.length) return;
    const pending: Record<string, MiniTicker> = {};
    let raf = 0;
    const stop = openStream(
      symbols.map((s) => `${s.toLowerCase()}@miniTicker`),
      (d) => {
        const t = d as { s: string; c: string; o: string; h: string; l: string; q: string };
        if (!t?.s) return;
        const price = Number(t.c);
        const open = Number(t.o);
        pending[t.s] = { symbol: t.s, price, open, high: Number(t.h), low: Number(t.l), quoteVolume: Number(t.q), changePct: open ? ((price - open) / open) * 100 : 0 };
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            setTickers((prev) => ({ ...prev, ...pending }));
          });
        }
      },
      setConnected,
    );
    return () => {
      cancelAnimationFrame(raf);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { tickers, connected };
}

export interface Depth {
  bids: [number, number][];
  asks: [number, number][];
}

export function useDepth(symbol: string, levels: 5 | 10 | 20 = 20) {
  const [depth, setDepth] = useState<Depth>();
  const [connected, setConnected] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    setDepth(undefined);
    return openStream(
      [`${symbol.toLowerCase()}@depth${levels}@500ms`],
      (d) => {
        const book = d as { bids: [string, string][]; asks: [string, string][] };
        if (!book?.bids) return;
        const now = Date.now();
        if (now - last.current < 400) return;
        last.current = now;
        setDepth({ bids: book.bids.map(([p, q]) => [Number(p), Number(q)]), asks: book.asks.map(([p, q]) => [Number(p), Number(q)]) });
      },
      setConnected,
    );
  }, [symbol, levels]);
  return { depth, connected };
}
