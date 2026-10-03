/**
 * All runtime configuration comes from environment variables (see .env.example).
 * Nothing secret is ever hard-coded here.
 */

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  /** Public URL of this app, used for OIDC redirect URIs. */
  appUrl: (env.APP_URL ?? 'http://localhost:8787').replace(/\/$/, ''),
  /**
   * live  = call free upstream sources, fall back to labelled demo data per-item on failure.
   * demo  = never call upstream (offline development, screenshots, CI).
   */
  dataMode: (env.DATA_MODE ?? 'live') as 'live' | 'demo',
  sessionSecret: env.SESSION_SECRET ?? '',
  kuartalId: {
    issuer: (env.KUARTAL_ID_ISSUER ?? 'https://id.kuartal.id').replace(/\/$/, ''),
    clientId: env.KUARTAL_ID_CLIENT_ID ?? '',
    clientSecret: env.KUARTAL_ID_CLIENT_SECRET ?? '',
    /** Entitlement key in Kuartal ID that unlocks Pro panels. The Pro membership grants research.premium. */
    premiumEntitlement: env.PREMIUM_ENTITLEMENT ?? 'research.premium',
    upgradeUrl: env.UPGRADE_URL ?? 'https://kuartal.id/membership',
  },
  /** Local development only: treat every visitor as Pro. Refused in production. */
  devGrantPro: bool(env.DEV_GRANT_PRO) && env.NODE_ENV !== 'production',
  /** Path to the built web app (web/dist). */
  staticDir: env.STATIC_DIR ?? new URL('../../web/dist', import.meta.url).pathname,
  userAgent: env.UPSTREAM_USER_AGENT ?? 'Mozilla/5.0 (compatible; KuartalTerminal/0.1; +https://terminal.kuartalsystems.com)',
};

export function authConfigured(): boolean {
  return Boolean(config.kuartalId.clientId && config.kuartalId.clientSecret && config.sessionSecret.length >= 32);
}
