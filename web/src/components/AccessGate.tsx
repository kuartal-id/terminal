import type { Me } from '@shared/types';
import { useStore } from '../lib/store';

/**
 * Shown instead of the terminal when the visitor isn't signed in with Kuartal ID
 * or their Kuartal ID doesn't hold Terminal Access (terminal.access).
 */
export function AccessGate({ me }: { me?: Me }) {
  const toast = useStore((s) => s.toast);
  const returnTo = encodeURIComponent(location.pathname + location.search);
  let title = 'Kuartal Terminal';
  let body: React.ReactNode;

  if (!me) {
    body = <p className="mute">Loading…</p>;
  } else if (!me.authConfigured) {
    title = 'Kuartal ID sign-in is being set up';
    body = <p>Kuartal Terminal is opening soon to Kuartal ID members. Please check back shortly.</p>;
  } else if (!me.authenticated) {
    body = (
      <>
        <p>Markets, macro and news in one workspace — built for Indonesia. Sign in with your Kuartal ID to continue.</p>
        <a className="btn primary gate-cta" href={`${me.loginUrl}?returnTo=${returnTo}`}>
          Log in with Kuartal ID
        </a>
        <p className="mute small">
          No Kuartal ID yet? <a href="https://id.kuartal.id/register">Create one free</a>, then ask for Terminal Access.
        </p>
      </>
    );
  } else {
    title = 'Terminal Access required';
    body = (
      <>
        <p>
          You're signed in{me.name ? ` as ${me.name}` : ''}{me.email ? ` (${me.email})` : ''}, but your Kuartal ID doesn't have
          Terminal Access yet.
        </p>
        <p className="mute">Access comes with a Kuartal membership, or can be granted by the Kuartal team.</p>
        <div className="gate-actions">
          <a className="btn primary" href={me.upgradeUrl} target="_blank" rel="noreferrer">
            See memberships
          </a>
          <a className="btn" href="mailto:hello@kuartal.id?subject=Kuartal%20Terminal%20access">
            Request access
          </a>
        </div>
        <p className="mute small">
          Already granted? Access updates within 15 minutes — or <a href={`${me.logoutUrl}`}>log out</a> and back in.
        </p>
      </>
    );
  }

  return (
    <main className="access-gate">
      <div className="access-card">
        <img src="/kuartal-icon-mark.png" alt="" width={56} height={56} />
        <div className="brand-word" style={{ justifyContent: 'center' }}>
          Kuartal <small>Terminal</small>
        </div>
        <h1>{title}</h1>
        {toast && <p role="status" style={{ color: 'var(--warn)' }}>{toast.text}</p>}
        {body}
        <p className="disclaimer">Research tool by PT Kuartal Financial Group. Not investment advice.</p>
      </div>
    </main>
  );
}
