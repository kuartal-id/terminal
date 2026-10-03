import ReactGridLayout, { useContainerWidth, verticalCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { activeWorkspace, useStore } from '../lib/store';
import { PanelFrame } from './PanelFrame';

export function Workspace() {
  const ws = useStore(activeWorkspace);
  const setLayout = useStore((s) => s.setLayout);
  const openPanel = useStore((s) => s.openPanel);
  const { width, containerRef, mounted } = useContainerWidth();

  if (!ws.panels.length) {
    return (
      <div className="workspace" ref={containerRef}>
        <div className="empty-ws">
          <div>
            <h2>Empty workspace</h2>
            <p>This workspace is empty. Restore a research dashboard or build one yourself from the command bar and left navigation.</p>
            <div className="empty-actions">
              <button className="btn" onClick={() => openPanel('PLS')}>Kuartal Pulse</button>
              <button className="btn" onClick={() => openPanel('CHT', { symbol: '^JKSE', linked: true })}>Chart IHSG</button>
              <button className="btn" onClick={() => openPanel('NWS')}>News</button>
              <button className="btn" onClick={() => openPanel('USA')}>US Markets</button>
              <button className="btn" onClick={() => openPanel('BND')}>Bonds & Treasuries</button>
              <button className="btn" onClick={() => openPanel('SBN')}>Indonesia SBN</button>
              <button className="btn" onClick={() => openPanel('FND')}>Funds</button>
              <button className="btn" onClick={() => openPanel('ASK')}>Ask Kuartal · Coming soon</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace" ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          key={ws.id}
          width={width}
          layout={ws.layout}
          gridConfig={{ cols: 12, rowHeight: 28, margin: [6, 6], containerPadding: [4, 4] }}
          dragConfig={{ enabled: true, handle: '.drag-handle', cancel: '.no-drag', bounded: false }}
          resizeConfig={{ enabled: true, handles: ['se'] }}
          compactor={verticalCompactor}
          onLayoutChange={(l) => setLayout(l)}
        >
          {ws.panels.map((p) => (
            <div key={p.id}>
              <PanelFrame panel={p} />
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  );
}
