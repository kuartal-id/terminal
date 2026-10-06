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
      const token = await nextIdToken(lastTokenBody.get('nonce') ?? '');
      return json({ access_token: 'test-access-token', token_type: 'Bearer', expires_in: 3600, ...(token ? { id_token: token } : {}) });
    }
    if (url === `${ISSUER}/oauth/userinfo`) return json({ sub: 'kuartal-sub-1', name: 'Test Person', email: 'p@example.com', entitlements: ['research.premium'] });
    throw new Error(`unexpected fetch ${url}`);
  });

  app = (await import('../src/index')).app;
});

beforeEach(() => {
  lastTokenBody = undefined;
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
