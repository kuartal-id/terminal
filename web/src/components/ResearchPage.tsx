import { useEffect, useState } from 'react';
import { PanelFrame } from './PanelFrame';
import type { PanelType } from '../lib/panels';
import type { Params } from '../lib/store';

type PageKey = 'markets' | 'indonesia' | 'fixed-income' | 'macro' | 'crypto' | 'research' | 'tools';

const PAGES: Record<PageKey, { title: string; subtitle: string; panels: [PanelType, Params, string][] }> = {
  markets: {
    title: 'Markets',
    subtitle: 'Global market dashboard across Indonesia, the US, Asia, FX and commodities.',
    panels: [['OVR', {}, 'Market overview'], ['USA', {}, 'US markets'], ['IDX', { view: 'heat' }, 'Indonesia equities'], ['FX', {}, 'FX'], ['NWS', { region: 'global' }, 'News']],
  },
  indonesia: {
    title: 'Indonesia',
    subtitle: 'A dedicated Indonesia research page for equities, rupiah, SBN and local market context.',
    panels: [['IDX', { view: 'heat' }, 'IDX equities'], ['SBN', {}, 'Government bonds'], ['FND', {}, 'Funds & fixed income'], ['FX', {}, 'Rupiah'], ['NWS', { region: 'id' }, 'Indonesia news']],
  },
  'fixed-income': {
    title: 'Bonds & Rates',
    subtitle: 'Treasuries, rates, bond ETFs and Indonesian government securities.',
    panels: [['YC', {}, 'US Treasury curve'], ['BND', {}, 'Bonds & rates'], ['SBN', {}, 'Indonesia SBN'], ['FND', {}, 'Funds & fixed income'], ['MAC', { indicator: 'FR.INR.LEND', countries: 'IDN,USA' }, 'Rates context']],
  },
  macro: {
    title: 'Macro',
    subtitle: 'Rates, currencies, macro indicators and cross-asset context.',
    panels: [['PLS', {}, 'Kuartal Pulse'], ['YC', {}, 'Yield curve'], ['MAC', { indicator: 'FP.CPI.TOTL.ZG', countries: 'IDN,MYS,THA,PHL,VNM,USA' }, 'Macro comparison'], ['FX', {}, 'FX board'], ['NWS', { region: 'global', topic: 'central-banks' }, 'Central-bank news']],
  },
  crypto: {
    title: 'Digital Assets',
    subtitle: 'Live crypto markets, depth and related headlines.',
    panels: [['CRY', {}, 'Crypto live'], ['CHT', { symbol: 'BTCUSDT', range: '1M', linked: true }, 'Bitcoin chart'], ['BOOK', { symbol: 'BTCUSDT' }, 'Order book'], ['NWS', { topic: 'crypto' }, 'Crypto news']],
  },
  research: {
    title: 'Research',
    subtitle: 'Screeners, correlation, seasonality and market research tools.',
    panels: [['SCR', {}, 'Market screener'], ['COR', {}, 'Correlation'], ['SEA', { symbol: '^JKSE' }, 'Seasonality'], ['NWS', {}, 'News & research'], ['CAL', {}, 'Calculators']],
  },
  tools: {
    title: 'Tools',
    subtitle: 'Practical research tools and the Kuartal Terminal guide.',
    panels: [['HUB', {}, 'Asset class hub'], ['CAL', {}, 'Calculators'], ['WL', {}, 'Watchlist'], ['CLK', {}, 'Market hours'], ['HELP', {}, 'Terminal guide']],
  },
};

export function ResearchPage({ page }: { page: PageKey }) {
  const spec = PAGES[page];
  const [version, setVersion] = useState(0);
  useEffect(() => { setVersion((v) => v + 1); }, [page]);
  return (
    <div className="research-page">
      <div className="research-hero">
        <div>
          <div className="section-label">KUARTAL TERMINAL · {page.toUpperCase()}</div>
          <h1>{spec.title}</h1>
          <p>{spec.subtitle}</p>
        </div>
        {page === 'research' && <span className="tier pro">PRO TOOLS</span>}
      </div>
      <div className="research-grid" key={version}>
        {spec.panels.map(([type, params, label], i) => (
          <div className="research-card" key={`${type}-${i}`}>
            <div className="research-card-label">{label}</div>
            <PanelFrame panel={{ id: `page-${page}-${type}-${i}`, type, params }} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

export type { PageKey };
