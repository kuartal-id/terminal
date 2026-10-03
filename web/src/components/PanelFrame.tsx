import { Component, memo, useCallback, useState, type ReactNode } from 'react';
import { PANELS } from '../lib/panels';
import { useStore, type PanelInstance, type Params } from '../lib/store';
import { timeAgo } from '../lib/format';
import { PANEL_COMPONENTS } from '../panels/registry';
import type { PanelStatus } from '../panels/types';
import { SourceBadge } from './bits';
import { I } from './Icons';

class Boundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="errbox">
          This panel hit an error: {this.state.err.message}.{' '}
          <button className="btn small" onClick={() => this.setState({ err: undefined })}>
            Reload panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const PanelFrame = memo(function PanelFrame({ panel, compact, onParams }: { panel: PanelInstance; compact?: boolean; onParams?: (patch: Params) => void }) {
  const meta = PANELS[panel.type];
  const Comp = PANEL_COMPONENTS[panel.type];
  const closePanel = useStore((s) => s.closePanel);
  const updateParams = useStore((s) => s.updateParams);
  const [status, setStatus] = useState<PanelStatus>({});
  const [reloadKey, setReloadKey] = useState(0);
  const report = useCallback((st: PanelStatus) => setStatus((prev) => (prev.source === st.source && prev.provider === st.provider && prev.sub === st.sub && prev.asOf === st.asOf ? prev : st)), []);
  const set = useCallback((patch: Params) => (onParams ? onParams(patch) : updateParams(panel.id, patch)), [onParams, updateParams, panel.id]);

  return (
    <section className="panel" data-panel-id={panel.id} aria-label={meta.title}>
      <header className="panel-head drag-handle">
        <span className="panel-code">{panel.type}</span>
        <span className="panel-title">{meta.title}</span>
        {status.sub && <span className="panel-sub">· {status.sub}</span>}
        {meta.pro && <span className="tier pro" title="Kuartal Pro panel">PRO</span>}
        <div className="panel-actions no-drag">
          <SourceBadge source={status.source} />
          <button className="icon-btn" title="Refresh" aria-label="Refresh panel" onClick={() => setReloadKey((k) => k + 1)}>
            <I.refresh />
          </button>
          {!compact && (
            <button className="icon-btn" title="Close" aria-label="Close panel" onClick={() => closePanel(panel.id)}>
              <I.close />
            </button>
          )}
        </div>
      </header>
      <div className="panel-body no-drag">
        <Boundary>
          <Comp key={reloadKey} id={panel.id} params={panel.params} set={set} report={report} compact={compact} />
        </Boundary>
      </div>
      {(status.provider || status.asOf) && (
        <footer className="panel-foot">
          <span title={status.provider}>{status.provider}</span>
          {status.asOf && <span>{timeAgo(status.asOf)} ago</span>}
        </footer>
      )}
    </section>
  );
});
