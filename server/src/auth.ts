import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import type { Me, Tier } from '../../shared/types';
import { authConfigured, config } from './config';

/**
 * "Log in with Kuartal ID" — OpenID Connect authorization-code flow with PKCE
 * against id.kuartal.id (see the kuartal-login repo).
 *
 * The terminal is a confidential client: the code exchange happens here on
 * the server, so the client secret and access token never reach the browser.
 * After login we keep only a signed session cookie with the user's sub, name,
 * email and entitlement keys (no tokens are stored).
 */

const SESSION_COOKIE = 'kt_session';
const FLOW_COOKIE = 'kt_oidc';
const SESSION_DAYS = 7;

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
}

export async function readSession(c: Context): Promise<SessionClaims | null> {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw || !authConfigured()) return null;
  try {
    const { payload } = await jwtVerify(raw, secretKey(), { issuer: 'kuartal-terminal' });
    return { sub: String(payload.sub), name: payload.name as string | undefined, email: payload.email as string | undefined, ent: (payload.ent as string[]) ?? [] };
  } catch {
    return null;
  }
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
    }),
  });
  if (!tokenRes.ok) return fail('token');
  const tokens = (await tokenRes.json()) as { access_token: string; id_token?: string };

  let sub = '';
  let name: string | undefined;
  let email: string | undefined;
  if (tokens.id_token) {
    try {
      const { payload } = await jwtVerify(tokens.id_token, jwks!, { audience: config.kuartalId.clientId });
      if (payload.nonce !== flow.nonce) return fail('nonce');
      sub = String(payload.sub);
      name = payload.name as string | undefined;
      email = payload.email as string | undefined;
    } catch {
      return fail('id_token');
    }
  }
  // Entitlements are not in the ID token; Kuartal ID returns them from /oauth/userinfo.
  let ent: string[] = [];
  const ui = await fetch(d.userinfo_endpoint, { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' } });
  if (ui.ok) {
    const info = (await ui.json()) as { sub?: string; name?: string; email?: string; entitlements?: unknown[] };
    sub ||= String(info.sub ?? '');
    name ??= info.name;
    email ??= info.email;
    ent = (info.entitlements ?? []).map((e) => (typeof e === 'string' ? e : String((e as { key?: string }).key ?? ''))).filter(Boolean);
  }
  if (!sub) return fail('profile');

  const session = await new SignJWT({ name, email, ent })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer('kuartal-terminal')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
  setCookie(c, SESSION_COOKIE, session, { httpOnly: true, secure: secure(), sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86400 });
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
