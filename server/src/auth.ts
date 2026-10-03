import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createRemoteJWKSet, EncryptJWT, jwtDecrypt, jwtVerify, SignJWT } from 'jose';
import type { Me, Tier } from '../../shared/types';
import { authConfigured, config } from './config';

/**
 * "Log in with Kuartal ID" — OpenID Connect authorization-code flow with PKCE
 * against id.kuartal.id (see the kuartal-login repo).
 *
 * The terminal is a confidential client: the code exchange happens here on
 * the server, so the client secret and access token never reach the browser.
 * After login we keep an ENCRYPTED session cookie (A256GCM) with the user's sub,
 * name, email, entitlement keys and Kuartal ID refresh token. Every
 * RECHECK_MS the server silently refreshes and re-reads entitlements, so when
 * an admin revokes terminal.access (or a paid membership expires) the user
 * loses access within ~15 minutes, without having to log in again.
 */

const SESSION_COOKIE = 'kt_session';
const FLOW_COOKIE = 'kt_oidc';
const SESSION_DAYS = 30; // matches Kuartal ID refresh-token lifetime
const RECHECK_MS = 15 * 60_000;

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  issuer: string;
}

let discovery: Discovery | undefined;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

async function getDiscovery(): Promise<Discovery> {
  if (discovery) return discovery;
  const iss = config.kuartalId.issuer;
  try {
    const res = await fetch(`${iss}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(String(res.status));
    discovery = (await res.json()) as Discovery;
  } catch {
    // Same paths kuartal-login serves (routes/oauth.php, routes/api.php).
    discovery = {
      issuer: iss,
      authorization_endpoint: `${iss}/oauth/authorize`,
      token_endpoint: `${iss}/oauth/token`,
      userinfo_endpoint: `${iss}/oauth/userinfo`,
      jwks_uri: `${iss}/oauth/jwks`,
      end_session_endpoint: `${iss}/oauth/logout`,
    };
  }
  jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
  return discovery;
}

const secretKey = () => new TextEncoder().encode(config.sessionSecret);
let encKey: Uint8Array | undefined;
async function encryptionKey(): Promise<Uint8Array> {
  encKey ??= new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kt-session:${config.sessionSecret}`)));
  return encKey;
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  return Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64url');
}

function randomString(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
}

const redirectUri = () => `${config.appUrl}/auth/callback`;
const secure = () => config.appUrl.startsWith('https://');

export interface SessionClaims {
  sub: string;
  name?: string;
  email?: string;
  ent: string[];
  /** Kuartal ID refresh token (never sent to the browser in readable form). */
  rt?: string;
  /** Unix ms when entitlements were last confirmed with Kuartal ID. */
  chk: number;
}

/** Encrypt session claims into the cookie value. Exported for tests. */
export async function sealSession(s: SessionClaims): Promise<string> {
  return new EncryptJWT({ name: s.name, email: s.email, ent: s.ent, rt: s.rt, chk: s.chk })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setSubject(s.sub)
    .setIssuer('kuartal-terminal')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .encrypt(await encryptionKey());
}

async function writeSession(c: Context, s: SessionClaims) {
  const jwt = await sealSession(s);
  setCookie(c, SESSION_COOKIE, jwt, { httpOnly: true, secure: secure(), sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86400 });
}

async function decodeSession(raw: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtDecrypt(raw, await encryptionKey(), { issuer: 'kuartal-terminal' });
    return {
      sub: String(payload.sub),
      name: payload.name as string | undefined,
      email: payload.email as string | undefined,
      ent: (payload.ent as string[]) ?? [],
      rt: payload.rt as string | undefined,
      chk: Number(payload.chk ?? 0),
    };
  } catch {
    return null;
  }
}

/** Refresh in flight per refresh token, so parallel requests share one rotation (Kuartal ID detects token reuse). */
const refreshing = new Map<string, Promise<SessionClaims | null>>();

async function recheck(s: SessionClaims): Promise<SessionClaims | null> {
  if (!s.rt) return null;
  const d = await getDiscovery();
  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.rt, client_id: config.kuartalId.clientId, client_secret: config.kuartalId.clientSecret, scope: 'openid profile email entitlements' }),
  });
  if (res.status === 400 || res.status === 401) return null; // revoked / expired → signed out
  if (!res.ok) throw new Error(`token ${res.status}`); // Kuartal ID hiccup → keep old session for now
  const tokens = (await res.json()) as { access_token: string; refresh_token?: string };
  const info = await fetchUserinfo(d.userinfo_endpoint, tokens.access_token);
  if (!info) throw new Error('userinfo failed');
  if (info.sub && info.sub !== s.sub) return null; // different account behind this token → sign out
  return { ...s, name: info.name ?? s.name, email: info.email ?? s.email, ent: info.ent, rt: tokens.refresh_token ?? s.rt, chk: Date.now() };
}

/** Current session, silently re-checked with Kuartal ID every RECHECK_MS. Updates/clears the cookie as needed. */
export async function readSession(c: Context): Promise<SessionClaims | null> {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw || !authConfigured()) return null;
  const s = await decodeSession(raw);
  if (!s) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return null;
  }
  if (Date.now() - s.chk < RECHECK_MS || !s.rt) return s;
  let p = refreshing.get(s.rt);
  if (!p) {
    p = recheck(s);
    refreshing.set(s.rt, p);
    const key = s.rt;
    p.finally(() => setTimeout(() => refreshing.delete(key), 60_000)).catch(() => {});
  }
  try {
    const fresh = await p;
    if (!fresh) {
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      return null;
    }
    await writeSession(c, fresh);
    return fresh;
  } catch {
    return s; // Kuartal ID temporarily unreachable: keep the last known entitlements
  }
}

async function fetchUserinfo(url: string, accessToken: string): Promise<{ sub?: string; name?: string; email?: string; ent: string[] } | null> {
  const ui = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (!ui.ok) return null;
  const info = (await ui.json()) as { sub?: string; name?: string; email?: string; entitlements?: unknown[] };
  const ent = (info.entitlements ?? []).map((e) => (typeof e === 'string' ? e : String((e as { key?: string }).key ?? ''))).filter(Boolean);
  return { sub: info.sub ? String(info.sub) : undefined, name: info.name, email: info.email, ent };
}

/** May this visitor use the terminal at all? */
export function hasAccess(session: SessionClaims | null): boolean {
  if (config.devGrantPro || !config.requireLogin) return true;
  return Boolean(session?.ent.includes(config.kuartalId.accessEntitlement));
}

export function tierFor(session: SessionClaims | null): Tier {
  if (config.devGrantPro) return 'pro';
  if (!session) return 'guest';
  return session.ent.includes(config.kuartalId.premiumEntitlement) ? 'pro' : 'free';
}

export async function me(c: Context): Promise<Me> {
  const s = await readSession(c);
  return {
    authenticated: Boolean(s),
    authConfigured: authConfigured(),
    tier: tierFor(s),
    sub: s?.sub,
    name: s?.name,
    email: s?.email,
    entitlements: s?.ent ?? [],
    access: hasAccess(s),
    loginRequired: config.requireLogin && !config.devGrantPro,
    loginUrl: '/auth/login',
    logoutUrl: '/auth/logout',
    upgradeUrl: config.kuartalId.upgradeUrl,
  };
}

export async function login(c: Context) {
  if (!authConfigured()) return c.redirect('/?auth=not-configured');
  const d = await getDiscovery();
  const state = randomString();
  const nonce = randomString();
  const verifier = randomString(48);
  const returnTo = sanitizeReturn(c.req.query('returnTo'));
  const flow = await new SignJWT({ state, nonce, verifier, returnTo })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secretKey());
  setCookie(c, FLOW_COOKIE, flow, { httpOnly: true, secure: secure(), sameSite: 'Lax', path: '/auth', maxAge: 600 });
  const url = new URL(d.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.kuartalId.clientId,
    redirect_uri: redirectUri(),
    scope: 'openid profile email entitlements',
    state,
    nonce,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
  }).toString();
  return c.redirect(url.toString());
}

export async function callback(c: Context) {
  if (!authConfigured()) return c.redirect('/?auth=not-configured');
  const fail = (reason: string) => c.redirect(`/?auth=error&reason=${encodeURIComponent(reason)}`);
  const flowRaw = getCookie(c, FLOW_COOKIE);
  deleteCookie(c, FLOW_COOKIE, { path: '/auth' });
  if (!flowRaw) return fail('expired');
  let flow: { state: string; nonce: string; verifier: string; returnTo: string };
  try {
    flow = (await jwtVerify(flowRaw, secretKey())).payload as unknown as typeof flow;
  } catch {
    return fail('expired');
  }
  if (c.req.query('error')) return fail(c.req.query('error')!);
  if (c.req.query('state') !== flow.state) return fail('state');
  const code = c.req.query('code');
  if (!code) return fail('code');

  const d = await getDiscovery();
  const tokenRes = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: config.kuartalId.clientId,
      client_secret: config.kuartalId.clientSecret,
      code_verifier: flow.verifier,
      // Kuartal ID binds the nonce at /oauth/authorize (since 2026-10-06);
      // also sending it here keeps older Kuartal ID builds working.
      nonce: flow.nonce,
    }),
  });
  if (!tokenRes.ok) return fail('token');
  const tokens = (await tokenRes.json()) as { access_token: string; id_token?: string; refresh_token?: string };

  let sub = '';
  let name: string | undefined;
  let email: string | undefined;
  // The id_token is mandatory: signature (JWKS), issuer, audience, exp/iat
  // and nonce must all check out, otherwise the login is refused.
  if (!tokens.id_token) return fail('id_token');
  try {
    const { payload } = await jwtVerify(tokens.id_token, jwks!, {
      issuer: config.kuartalId.issuer,
      audience: config.kuartalId.clientId,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
      clockTolerance: 60,
    });
    if (typeof payload.nonce !== 'string' || payload.nonce !== flow.nonce) return fail('nonce');
    sub = String(payload.sub);
    name = payload.name as string | undefined;
    email = payload.email as string | undefined;
  } catch {
    return fail('id_token');
  }
  // Entitlements are not in the ID token; Kuartal ID returns them from /oauth/userinfo.
  const info = await fetchUserinfo(d.userinfo_endpoint, tokens.access_token);
  if (!info) return fail('userinfo');
  // The profile must belong to the same person the signed id_token names.
  if (info.sub && info.sub !== sub) return fail('profile');
  name ??= info.name;
  email ??= info.email;
  if (!sub) return fail('profile');

  await writeSession(c, { sub, name, email, ent: info.ent, rt: tokens.refresh_token, chk: Date.now() });
  return c.redirect(flow.returnTo || '/');
}

export async function logout(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  if (!authConfigured()) return c.redirect('/');
  const d = await getDiscovery();
  const end = d.end_session_endpoint ?? `${config.kuartalId.issuer}/oauth/logout`;
  return c.redirect(`${end}?post_logout_redirect_uri=${encodeURIComponent(config.appUrl + '/')}`);
}

/** Only allow same-site relative paths as post-login destinations (no open redirects). */
export function sanitizeReturn(v: string | undefined): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return '/';
  return v.slice(0, 300);
}
