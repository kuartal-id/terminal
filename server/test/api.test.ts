import { beforeAll, describe, expect, it } from 'vitest';

// Offline: never touch upstreams in CI.
process.env.DATA_MODE = 'demo';
process.env.DEV_GRANT_PRO = '';

let app: typeof import('../src/index').app;
beforeAll(async () => {
  app = (await import('../src/index')).app;
});

const get = (path: string) => app.request(path);

describe('API (demo mode)', () => {
  it('health reports demo mode and no auth', async () => {
    const r = await get('/api/health');
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.dataMode).toBe('demo');
    expect(j.authConfigured).toBe(false);
  });

  it('quotes resolve friendly names and label demo data honestly', async () => {
    const r = await get('/api/quotes?symbols=IHSG,BBCA,BTC,rupiah');
    const j = await r.json();
    expect(j.data.map((q: { symbol: string }) => q.symbol)).toEqual(['^JKSE', 'BBCA.JK', 'BTCUSDT', 'IDR=X']);
    expect(j.source).toBe('demo');
    expect(j.note).toMatch(/DEMO/);
    for (const q of j.data) expect(q.source).toBe('demo');
  });

  it('quotes requires symbols', async () => {
    expect((await get('/api/quotes')).status).toBe(400);
  });

  it('history validates range and returns candles', async () => {
    expect((await get('/api/history?symbol=BBCA&range=9Y')).status).toBe(400);
    const j = await (await get('/api/history?symbol=BBCA&range=6M')).json();
    expect(j.data.symbol).toBe('BBCA.JK');
    expect(j.data.candles.length).toBeGreaterThan(50);
  });

  it('pulse, fx, yields, macro and news all answer', async () => {
    for (const p of ['/api/pulse', '/api/fx', '/api/yields', '/api/macro?indicator=FP.CPI.TOTL.ZG&countries=IDN,VNM', '/api/news?region=id']) {
      const r = await get(p);
      expect(r.status, p).toBe(200);
      const j = await r.json();
      expect(j.source, p).toBe('demo');
      expect(j.data, p).toBeTruthy();
    }
  });

  it('macro rejects unknown indicators', async () => {
    expect((await get('/api/macro?indicator=DROP TABLE')).status).toBe(400);
  });

  it('pro endpoints require login when auth is not configured', async () => {
    const r = await get('/api/pro/correlation');
    expect(r.status).toBe(401);
    expect((await r.json()).code).toBe('login_required');
  });

  it('me returns guest tier', async () => {
    const j = await (await get('/api/me')).json();
    expect(j.tier).toBe('guest');
    expect(j.authenticated).toBe(false);
  });

  it('login redirects safely when not configured', async () => {
    const r = await get('/auth/login');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/?auth=not-configured');
  });

  it('AI placeholder returns 501 so the client falls back to rules', async () => {
    const r = await app.request('/api/ai/ask', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    expect(r.status).toBe(501);
  });

  it('unknown API paths are JSON 404s and security headers are set', async () => {
    const r = await get('/api/does-not-exist');
    expect(r.status).toBe(404);
    expect(r.headers.get('content-type')).toMatch(/json/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
