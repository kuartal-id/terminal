import type { Action } from './assistant';
import { useStore } from './store';

/** Execute assistant/command actions against the store. Single code path for command bar + Ask Kuartal. */
export function runActions(actions: Action[]) {
  const s = useStore.getState();
  for (const a of actions) {
    switch (a.kind) {
      case 'open':
        s.openPanel(a.type, a.params ?? {}, { reuse: a.reuse });
        // The mobile shell has no workspace grid; it listens for this to show the panel.
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kt:open-panel', { detail: { type: a.type } }));
        break;
      case 'focus':
        s.focus(a.symbol);
        break;
      case 'watch':
        s.toggleWatch(a.symbol);
        break;
      case 'workspace':
        s.addWorkspace(a.preset);
        break;
      case 'theme':
        s.setTheme(a.theme);
        break;
    }
  }
}
