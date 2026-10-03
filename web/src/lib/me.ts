import { create } from 'zustand';
import type { Me } from '@shared/types';
import { api } from './api';

/** Current Kuartal ID session (from the server's /api/me). */
const useMeStore = create<{ me?: Me; loaded: boolean }>(() => ({ loaded: false }));

export async function loadMe() {
  try {
    const me = await api<Me>('/api/me');
    useMeStore.setState({ me, loaded: true });
  } catch {
    useMeStore.setState({
      loaded: true,
      me: { authenticated: false, authConfigured: false, tier: 'guest', entitlements: [], access: false, loginRequired: true, loginUrl: '/auth/login', logoutUrl: '/auth/logout', upgradeUrl: 'https://kuartal.id/membership' },
    });
  }
}

export const useMe = () => useMeStore((s) => s.me);
export const useMeLoaded = () => useMeStore((s) => s.loaded);
