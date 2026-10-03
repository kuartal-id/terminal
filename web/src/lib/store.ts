import { create } from 'zustand';
import { PANELS, type PanelType } from './panels';
import { storage } from './storage';

/**
 * Global UI state: workspaces (tabs of panels + grid layout), watchlist,
 * focused symbol, theme. Persisted to localStorage under STORAGE_KEY.
 *
 * ⚠️ If you change the persisted shape, bump STORAGE_KEY's version AND write
 * a migration in `load()` — otherwise every existing user's saved layout breaks.
 */
export const STORAGE_KEY = 'kuartal-terminal:v1';

export type Params = Record<string, string | number | boolean | undefined>;

export interface PanelInstance {
  id: string;
  type: PanelType;
  params: Params;
}

export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface Workspace {
  id: string;
  name: string;
  panels: PanelInstance[];
  layout: GridItem[];
}

type PresetKey = 'desk' | 'indonesia' | 'macro' | 'crypto' | 'blank';

interface PersistedState {
  workspaces: Workspace[];
  activeId: string;
  watchlist: string[];
  theme: 'dark' | 'light';
  focusSymbol: string;
}

interface State extends PersistedState {
  toast?: { id: number; text: string };
  openPanel: (type: PanelType, params?: Params, opts?: { reuse?: boolean }) => string;
  closePanel: (id: string) => void;
  updateParams: (id: string, patch: Params) => void;
  setLayout: (layout: readonly GridItem[]) => void;
  addWorkspace: (preset?: PresetKey, name?: string) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  setActive: (id: string) => void;
  resetActive: () => void;
  focus: (symbol: string) => void;
  toggleWatch: (symbol: string) => void;
  setWatchlist: (symbols: string[]) => void;
  setTheme: (t: 'dark' | 'light') => void;
  notify: (text: string) => void;
}

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function item(id: string, type: PanelType, x: number, y: number, w?: number, h?: number): GridItem {
  const m = PANELS[type];
  return { i: id, x, y, w: w ?? m.w, h: h ?? m.h, minW: m.minW, minH: m.minH };
}

/** Build a preset workspace. Layout is a 12-column grid. */
export function preset(key: PresetKey): Workspace {
  const spec: Record<PresetKey, { name: string; panels: [PanelType, Params, number, number, number, number][] }> = {
    desk: {
      name: 'Kuartal Desk',
      panels: [
        ['PLS', {}, 0, 0, 5, 11],
        ['CHT', { symbol: '^JKSE', range: '1Y', linked: true }, 5, 0, 7, 13],
        ['OVR', {}, 0, 11, 5, 16],
        ['NWS', { region: 'all' }, 5, 13, 4, 14],
        ['WL', {}, 9, 13, 3, 14],
      ],
    },
    indonesia: {
      name: 'Indonesia',
      panels: [
        ['IDX', { view: 'heat' }, 0, 0, 7, 13],
        ['CHT', { symbol: 'BBCA', range: '6M', linked: true }, 7, 0, 5, 13],
        ['FX', {}, 0, 13, 4, 12],
        ['NWS', { region: 'id' }, 4, 13, 4, 12],
        ['CLK', {}, 8, 13, 4, 12],
      ],
    },
    macro: {
      name: 'Global Macro',
      panels: [
        ['YC', {}, 0, 0, 5, 12],
        ['MAC', { indicator: 'FP.CPI.TOTL.ZG', countries: 'IDN,MYS,THA,PHL,VNM,USA' }, 5, 0, 7, 12],
        ['FX', {}, 0, 12, 4, 12],
        ['OVR', { groups: 'Rates,FX,Commodities' }, 4, 12, 4, 12],
        ['NWS', { region: 'global', topic: 'central-banks' }, 8, 12, 4, 12],
      ],
    },
    crypto: {
      name: 'Crypto',
      panels: [
        ['CRY', {}, 0, 0, 4, 12],
        ['CHT', { symbol: 'BTCUSDT', range: '1M', linked: true }, 4, 0, 5, 12],
        ['BOOK', { symbol: 'BTCUSDT' }, 9, 0, 3, 18],
        ['NWS', { topic: 'crypto' }, 0, 12, 9, 10],
      ],
    },
    blank: { name: 'New workspace', panels: [] },
  };
  const s = spec[key];
  const panels: PanelInstance[] = [];
  const layout: GridItem[] = [];
  for (const [type, params, x, y, w, h] of s.panels) {
    const id = uid(type.toLowerCase());
    panels.push({ id, type, params });
    layout.push(item(id, type, x, y, w, h));
  }
  return { id: uid('ws'), name: s.name, panels, layout };
}

function defaults(): PersistedState {
  const ws = [preset('desk'), preset('indonesia'), preset('macro'), preset('crypto')];
  return {
    workspaces: ws,
    activeId: ws[0].id,
    watchlist: ['^JKSE', 'BBCA', 'BBRI', 'TLKM', 'IDR=X', 'GC=F', 'BTCUSDT'],
    theme: 'dark',
    focusSymbol: '^JKSE',
  };
}

function load(): PersistedState {
  const saved = storage.get<PersistedState | null>(STORAGE_KEY, null);
  if (!saved || !Array.isArray(saved.workspaces) || !saved.workspaces.length) return defaults();
  // Drop panels whose type no longer exists (defensive against old saves).
  const workspaces = saved.workspaces.map((w) => {
    const panels = w.panels.filter((p) => p.type in PANELS);
    const ids = new Set(panels.map((p) => p.id));
    return { ...w, panels, layout: w.layout.filter((l) => ids.has(l.i)) };
  });
  return {
    ...defaults(),
    ...saved,
    workspaces,
    activeId: workspaces.some((w) => w.id === saved.activeId) ? saved.activeId : workspaces[0].id,
  };
}

const initial = load();

export const useStore = create<State>((set, get) => {
  const mutateActive = (fn: (w: Workspace) => Workspace) =>
    set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === s.activeId ? fn(w) : w)) }));

  return {
    ...initial,

    openPanel(type, params = {}, opts = {}) {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeId)!;
      if (opts.reuse) {
        const existing = ws.panels.find((p) => p.type === type);
        if (existing) {
          get().updateParams(existing.id, params);
          flash(existing.id);
          return existing.id;
        }
      }
      const id = uid(type.toLowerCase());
      const m = PANELS[type];
      const bottom = ws.layout.reduce((mx, l) => Math.max(mx, l.y + l.h), 0);
      mutateActive((w) => ({
        ...w,
        panels: [...w.panels, { id, type, params }],
        layout: [...w.layout, item(id, type, 0, bottom, Math.min(12, m.w), m.h)],
      }));
      setTimeout(() => flash(id), 50);
      return id;
    },

    closePanel(id) {
      mutateActive((w) => ({ ...w, panels: w.panels.filter((p) => p.id !== id), layout: w.layout.filter((l) => l.i !== id) }));
    },

    updateParams(id, patch) {
      set((s) => ({
        workspaces: s.workspaces.map((w) => ({
          ...w,
          panels: w.panels.map((p) => (p.id === id ? { ...p, params: { ...p.params, ...patch } } : p)),
        })),
      }));
    },

    setLayout(layout) {
      mutateActive((w) => ({
        ...w,
        layout: layout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, minW: l.minW, minH: l.minH })),
      }));
    },

    addWorkspace(key = 'blank', name) {
      const ws = preset(key);
      if (name) ws.name = name;
      set((s) => ({ workspaces: [...s.workspaces, ws], activeId: ws.id }));
    },

    removeWorkspace(id) {
      set((s) => {
        if (s.workspaces.length <= 1) return s;
        const workspaces = s.workspaces.filter((w) => w.id !== id);
        return { workspaces, activeId: s.activeId === id ? workspaces[0].id : s.activeId };
      });
    },

    renameWorkspace(id, name) {
      set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name: name.slice(0, 40) || w.name } : w)) }));
    },

    setActive(id) {
      set({ activeId: id });
    },

    resetActive() {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeId)!;
      const map: Record<string, PresetKey> = { 'Kuartal Desk': 'desk', Indonesia: 'indonesia', 'Global Macro': 'macro', Crypto: 'crypto' };
      const fresh = preset(map[ws.name] ?? 'desk');
      mutateActive(() => ({ ...fresh, id: ws.id, name: ws.name }));
    },

    focus(symbol) {
      set((s) => ({
        focusSymbol: symbol,
        workspaces: s.workspaces.map((w) =>
          w.id !== s.activeId ? w : { ...w, panels: w.panels.map((p) => (p.params.linked ? { ...p, params: { ...p.params, symbol } } : p)) },
        ),
      }));
    },

    toggleWatch(symbol) {
      set((s) => {
        const has = s.watchlist.includes(symbol);
        return { watchlist: has ? s.watchlist.filter((x) => x !== symbol) : [...s.watchlist, symbol].slice(0, 60) };
      });
      get().notify(get().watchlist.includes(symbol) ? `Added ${symbol} to watchlist` : `Removed ${symbol} from watchlist`);
    },

    setWatchlist(symbols) {
      set({ watchlist: symbols });
    },

    setTheme(theme) {
      set({ theme });
    },

    notify(text) {
      const id = Date.now();
      set({ toast: { id, text } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: undefined });
      }, 3200);
    },
  };
});

function flash(id: string) {
  const el = document.querySelector(`[data-panel-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el.classList.add('focus');
  setTimeout(() => el.classList.remove('focus'), 1400);
}

// Persist (debounced).
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { workspaces, activeId, watchlist, theme, focusSymbol } = s;
    storage.set(STORAGE_KEY, { workspaces, activeId, watchlist, theme, focusSymbol } satisfies PersistedState);
  }, 300);
});

export const activeWorkspace = (s: State) => s.workspaces.find((w) => w.id === s.activeId)!;
