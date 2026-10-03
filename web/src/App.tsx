import { useEffect, useState } from 'react';
import { loadMe } from './lib/me';
import { useStore } from './lib/store';
import { DesktopShell } from './components/Shell';
import { MobileShell } from './components/MobileShell';

const MOBILE_QUERY = '(max-width: 760px)';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

export function App() {
  const theme = useStore((s) => s.theme);
  const notify = useStore((s) => s.notify);
  const mobile = useIsMobile();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1319' : '#eef3f4');
  }, [theme]);

  useEffect(() => {
    loadMe();
    // Messages from the login flow (?auth=...)
    const p = new URLSearchParams(location.search);
    const auth = p.get('auth');
    if (auth) {
      if (auth === 'error') notify(`Kuartal ID login didn't complete (${p.get('reason') ?? 'unknown'}). Please try again.`);
      if (auth === 'not-configured') notify('Kuartal ID login is not configured on this server yet.');
      history.replaceState(null, '', location.pathname);
    }
  }, [notify]);

  return mobile ? <MobileShell /> : <DesktopShell />;
}
