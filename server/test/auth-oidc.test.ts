import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Kuartal ID is faked: discovery, /oauth/token, /oauth/userinfo and /oauth/jwks
// are answered by a stubbed global fetch, id_tokens are signed with a
// throwaway RSA key published as the JWKS. No network access.
const ISSUER = 'https://id.kuartal.test';
const CLIENT_ID = 'terminal-test-client';
process.env.DATA_MODE = 'demo';
process.env.DEV_GRANT_PRO = '';
process.env.APP_URL = 'http://localhost:8787';
process.env.KUARTAL_ID_ISSUER = ISSUER;
process.env.KUARTAL_ID_CLIENT_ID = CLIENT_ID;
process.env.KUARTAL_ID_CLIENT_SECRET = 'test-client-secret';
process.env.SESSION_SECRET = 'x'.repeat(48);

let app: typeof import('../src/index').app;
let privateKey: CryptoKey;
let jwk: Record<string, unknown>;

/** What the fake token endpoint returns next (id_token claims or a raw override). */
let nextIdToken: (nonce: string) => Promise<string | undefined>;
let lastTokenBody: URLSearchParams | undefined;
/** What the fake /oauth/userinfo returns next. */
let userinfo: Record<string, unknown>;
/** Status the fake token endpoint answers a refresh_token grant with (400 = revoked/expired). */
let refreshStatus = 200;
const DEFAULT_USERINFO = { sub: 'kuartal-sub-1', name: 'Test Person', email: 'p@example.com', entitlements: ['terminal.access', 'research.premium'] };

async function idToken(claims: Record<string, unknown>, key: CryptoKey = privateKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body = { iss: ISSUER, aud: CLIENT_ID, sub: 'kuartal-sub-1', iat: now, exp: now + 600, ...claims };
  for (const k of Object.keys(body)) if ((body as Record<string, unknown>)[k] === undefined) delete (body as Record<string, unknown>)[k];
  return new SignJWT(body).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(key);
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };

  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === `${ISSUER}/.well-known/openid-configuration`) return json({}, 404); // use the built-in fallback paths
    if (url === `${ISSUER}/oauth/jwks`) return json({ keys: [jwk] });
    if (url === `${ISSUER}/oauth/token`) {
      lastTokenBody = new URLSearchParams(String(init?.body ?? ''));
      if (lastTokenBody.get('grant_type') === 'refresh_token') {
        if (refreshStatus !== 200) return json({ error: 'invalid_grant' }, refreshStatus);
        return json({ access_token: 'refreshed-access-token', refresh_token: 'rt-rotated', token_type: 'Bearer', expires_in: 3600 });
      }
      const token = await nextIdToken(lastTokenBody.get('nonce') ?? '');
      return json({ access_token: 'test-access-token', refresh_token: 'rt-1', token_type: 'Bearer', expires_in: 3600, ...(token ? { id_token: token } : {}) });
    }
    if (url === `${ISSUER}/oauth/userinfo`) return json(userinfo);
    throw new Error(`unexpected fetch ${url}`);
  });

  app = (await import('../src/index')).app;
});

beforeEach(() => {
  lastTokenBody = undefined;
  userinfo = { ...DEFAULT_USERINFO };
  refreshStatus = 200;
});

/** Start a login, then come back to /auth/callback with the issued state + flow cookie. */
async function roundTrip(): Promise<{ res: Response; nonce: string }> {
  const start = await app.request('/auth/login');
  expect(start.status).toBe(302);
  const location = new URL(start.headers.get('location')!);
  const nonce = location.searchParams.get('nonce')!;
  const state = location.searchParams.get('state')!;
  const flowCookie = (start.headers.get('set-cookie') ?? '').split(';')[0];
  const res = await app.request(`/auth/callback?state=${state}&code=test-code`, { headers: { Cookie: flowCookie } });
  return { res, nonce };
}

const reason = (res: Response) => new URL(res.headers.get('location')!, 'http://x').searchParams.get('reason');
const sessionSet = (res: Response) => (res.headers.get('set-cookie') ?? '').includes('kt_session=ey');

describe('Kuartal ID login (OIDC callback)', () => {
  it('accepts a valid id_token and sends the nonce on authorize and token requests', async () => {
    nextIdToken = (nonce) => idToken({ nonce });
    const { res, nonce } = await roundTrip();
    expect(res.headers.get('location')).toBe('/');
    expect(sessionSet(res)).toBe(true);
    expect(nonce).toBeTruthy();
    expect(lastTokenBody?.get('nonce')).toBe(nonce);
  });

  it('rejects a nonce mismatch', async () => {
    nextIdToken = () => idToken({ nonce: 'someone-elses-nonce' });
    const { res } = await roundTrip();
    expect(reason(res)).toBe('nonce');
    expect(sessionSet(res)).toBe(false);
  });

  it('rejects an id_token without a nonce instead of skipping the check', async () => {
    nextIdToken = () => idToken({});
    const { res } = await roundTrip();
    expect(reason(res)).toBe('id_token');
    expect(sessionSet(res)).toBe(false);
  });

  it('rejects a token response without an id_token instead of skipping verification', async () => {
    nextIdToken = async () => undefined;
    const { res } = await roundTrip();
    expect(reason(res)).toBe('id_token');
    expect(sessionSet(res)).toBe(false);
  });

  it('rejects the wrong issuer', async () => {
    nextIdToken = (nonce) => idToken({ nonce, iss: 'https://evil.example' });
    const { res } = await roundTrip();
    expect(reason(res)).toBe('id_token');
  });

  it('rejects the wrong audience', async () => {
    nextIdToken = (nonce) => idToken({ nonce, aud: 'another-client' });
    const { res } = await roundTrip();
    expect(reason(res)).toBe('id_token');
  });

  it('rejects an expired id_token', async () => {
    const now = Math.floor(Date.now() / 1000);
    nextIdToken = (nonce) => idToken({ nonce, iat: now - 7200, exp: now - 3600 });
    const { res } = await roundTrip();
    expect(reason(res)).toBe('id_token');
  });

  it('rejects an id_token signed by an unknown key', async () => {
    const other = await generateKeyPair('RS256');
    nextIdToken = (nonce) => idToken({ nonce }, other.privateKey);
    const { res } = await roundTrip();
    expect(reason(res)).toBe('id_token');
  });
});

describe('Kuartal ID login (profile + periodic re-check)', () => {
  it('rejects a userinfo profile for a different account than the id_token', async () => {
    nextIdToken = (nonce) => idToken({ nonce });
    userinfo = { ...DEFAULT_USERINFO, sub: 'someone-else' };
    const { res } = await roundTrip();
    expect(reason(res)).toBe('profile');
    expect(sessionSet(res)).toBe(false);
  });

  it('a fresh login with terminal.access can use the data API', async () => {
    nextIdToken = (nonce) => idToken({ nonce });
    const { res } = await roundTrip();
    const cookie = (res.headers.get('set-cookie') ?? '').match(/kt_session=[^;]+/)![0];
    expect((await app.request('/api/quotes?symbols=IHSG', { headers: { Cookie: cookie } })).status).toBe(200);
  });

  // A session whose last check is older than 15 minutes triggers a refresh.
  const staleSession = async (ent: string[]) => {
    const { sealSession } = await import('../src/auth');
    return `kt_session=${await sealSession({ sub: 'kuartal-sub-1', name: 'Test', ent, rt: `rt-${Math.random()}`, chk: 0 })}`;
  };

  it('refreshes entitlements and rotates the refresh token', async () => {
    const res = await app.request('/api/quotes?symbols=IHSG', { headers: { Cookie: await staleSession(['terminal.access']) } });
    expect(res.status).toBe(200);
    expect(lastTokenBody?.get('grant_type')).toBe('refresh_token');
    expect(res.headers.get('set-cookie') ?? '').toContain('kt_session=ey');
  });

  it('signs out when the user revoked the app on Kuartal ID', async () => {
    refreshStatus = 400;
    const res = await app.request('/api/quotes?symbols=IHSG', { headers: { Cookie: await staleSession(['terminal.access']) } });
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie') ?? '').toMatch(/kt_session=;/);
  });

  it('blocks access within one re-check after an admin removes terminal.access', async () => {
    userinfo = { ...DEFAULT_USERINFO, entitlements: ['kuartal.member'] };
    const res = await app.request('/api/quotes?symbols=IHSG', { headers: { Cookie: await staleSession(['terminal.access']) } });
    expect(res.status).toBe(403);
  });

  it('signs out if the refreshed profile belongs to a different account', async () => {
    userinfo = { ...DEFAULT_USERINFO, sub: 'someone-else' };
    const res = await app.request('/api/quotes?symbols=IHSG', { headers: { Cookie: await staleSession(['terminal.access']) } });
    expect(res.status).toBe(401);
  });
});
