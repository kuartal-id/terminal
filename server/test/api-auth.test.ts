import { beforeAll, describe, expect, it } from 'vitest';

// Kuartal ID configured + login required (production defaults). Offline data.
process.env.DATA_MODE = 'demo';
process.env.DEV_GRANT_PRO = '';
process.env.REQUIRE_LOGIN = '';
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-1234567890';
process.env.KUARTAL_ID_CLIENT_ID = 'test-client';
process.env.KUARTAL_ID_CLIENT_SECRET = 'test-client-secret';
process.env.APP_URL = 'https://terminal.example.test';

let app: typeof import('../src/index').app;
let seal: typeof import('../src/auth').sealSession;
beforeAll(async () => {
  app = (await import('../src/index')).app;
  seal = (await import('../src/auth')).sealSession;
});

// chk = now → no background re-check with Kuartal ID during the test.
const cookieFor = async (ent: string[]) => `kt_session=${await seal({ sub: 'u-1', name: 'Test', email: 't@example.test', ent, rt: 'rt-1', chk: Date.now() })}`;
const get = async (path: string, ent?: string[]) => app.request(path, ent ? { headers: { cookie: await cookieFor(ent) } } : undefined);

describe('Kuartal ID gate', () => {
  it('health and me stay open; me reports no access for visitors', async () => {
    expect((await get('/api/health')).status).toBe(200);
    const me = await (await get('/api/me')).json();
    expect(me).toMatchObject({ authenticated: false, authConfigured: true, access: false, loginRequired: true, tier: 'guest' });
  });

  it('visitors get 401 login_required on data endpoints', async () => {
    for (const p of ['/api/quotes?symbols=IHSG', '/api/news', '/api/pulse', '/api/instruments', '/api/pro/correlation']) {
      const r = await get(p);
      expect(r.status, p).toBe(401);
      expect((await r.json()).code, p).toBe('login_required');
    }
  });

  it('signed-in users without terminal.access get 403 access_required', async () => {
    const r = await get('/api/quotes?symbols=IHSG', ['kuartal.member']);
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe('access_required');
    const me = await (await get('/api/me', ['kuartal.member'])).json();
    expect(me).toMatchObject({ authenticated: true, access: false, name: 'Test' });
  });

  it('terminal.access unlocks free panels but not Pro', async () => {
    expect((await get('/api/quotes?symbols=IHSG', ['terminal.access'])).status).toBe(200);
    const pro = await get('/api/pro/correlation', ['terminal.access']);
    expect(pro.status).toBe(402);
    const me = await (await get('/api/me', ['terminal.access'])).json();
    expect(me).toMatchObject({ access: true, tier: 'free' });
  });

  it('terminal.access + research.premium unlocks Pro', async () => {
    const r = await get('/api/pro/correlation?symbols=^JKSE,GC=F', ['terminal.access', 'research.premium']);
    expect(r.status).toBe(200);
  });

  it('tampered or foreign cookies are rejected', async () => {
    const r = await app.request('/api/quotes?symbols=IHSG', { headers: { cookie: 'kt_session=not-a-real-token' } });
    expect(r.status).toBe(401);
  });
});
