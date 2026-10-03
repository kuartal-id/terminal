import type { ComponentType } from 'react';
import type { PanelType } from '../lib/panels';
import { CorrelationPanel, SeasonalityPanel } from './analytics';
import { CryptoLive, OrderBook } from './crypto';
import { FxPanel, IdxMovers, MarketHours } from './indonesia';
import { MacroPanel, YieldCurvePanel } from './macro';
import { ChartPanel, MarketOverview, Watchlist } from './markets';
import { NewsPanel } from './news';
import { PulsePanel } from './pulse';
import { AskPanel, Calculators, GuidePanel } from './tools';
import { AssetHubPanel, BondsPanel, FundPanel, ScreenerPanel, SbnPanel, UsMarketsPanel } from './expanded';
import type { PanelProps } from './types';

/** Panel type → component. Metadata (titles, sizes, keywords) lives in lib/panels.ts. */
export const PANEL_COMPONENTS: Record<PanelType, ComponentType<PanelProps>> = {
  OVR: MarketOverview,
  PLS: PulsePanel,
  IDX: IdxMovers,
  CHT: ChartPanel,
  WL: Watchlist,
  NWS: NewsPanel,
  FX: FxPanel,
  YC: YieldCurvePanel,
  MAC: MacroPanel,
  CRY: CryptoLive,
  BOOK: OrderBook,
  CAL: Calculators,
  CLK: MarketHours,
  COR: CorrelationPanel,
  SEA: SeasonalityPanel,
  ASK: AskPanel,
  HELP: GuidePanel,
  USA: UsMarketsPanel,
  BND: BondsPanel,
  SBN: SbnPanel,
  FND: FundPanel,
  SCR: ScreenerPanel,
  HUB: AssetHubPanel,
};
