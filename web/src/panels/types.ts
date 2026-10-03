import type { DataSource } from '@shared/types';
import type { Params } from '../lib/store';

export interface PanelStatus {
  source?: DataSource;
  provider?: string;
  asOf?: string;
  /** Short context shown next to the title, e.g. the symbol being charted. */
  sub?: string;
}

export interface PanelProps {
  id: string;
  params: Params;
  set: (patch: Params) => void;
  report: (status: PanelStatus) => void;
  /** True when rendered inside the mobile shell. */
  compact?: boolean;
}
