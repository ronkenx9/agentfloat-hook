/**
 * Single shape for both demo and real data. UI never branches on source.
 */

export type OperatingMode = 'watch' | 'review' | 'auto-shadow' | 'autonomous';

export interface Receipt {
  /** USD earned by this wallet's idle USDC, all time. */
  earnedUsd: number;
  /** Days since first deposit. */
  daysActive: number;
  /** How many strategies tested over this wallet's lifetime. */
  strategiesTested: number;
  /** Connected wallet address, or null if disconnected. */
  wallet: `0x${string}` | null;
  /** If null + no wallet, render zero-state with explainer. */
  hasData: boolean;
}

export interface ModeState {
  current: OperatingMode;
  autoApproveAfterHours: number | null;
  guardrails: {
    maxProposalsPerDay: number;
    maxStrategiesRegistered: number;
    pinnedStrategyIds: number[];
    requireSecurityAuditFor: string[];
  };
}

export type ProposalStatus =
  | 'pending'
  | 'approved'
  | 'executed'
  | 'rejected'
  | 'rejected_by_rule'
  | 'pending_review';

export interface Proposal {
  id: string;                       // filename without .md
  proposedAt: string;               // ISO
  model: string;                    // e.g. llama-3.3-70b-versatile
  actionType: 'parameter_variant' | 'new_strategy' | 'scoring_change' | 'retire' | 'no_action';
  status: ProposalStatus;
  headline: string;
  reasoning: string;
  proposedChange: string;
  expectedOutcome: string;
  evidence: string;
  risks: string;
  /** When this will auto-approve under current operating mode (if applicable). */
  autoApprovesAt: string | null;    // ISO
  /** Execution metadata when status=executed. */
  execution: {
    txHash: `0x${string}` | null;
    deployedAddress: `0x${string}` | null;
    strategyId: number | null;
    executedAt: string | null;
  } | null;
}

export interface Strategy {
  strategyId: number;
  name: string;
  address: `0x${string}`;
  status: 'active' | 'shadow' | 'paused' | 'retired';
  isShadow: boolean;
  expectedApyBps: number;
  riskProfile: 'zero' | 'simulated' | 'protocol' | 'experimental';
}

export interface SystemHealth {
  lastEpochAt: string | null;       // ISO of last scoring tick
  agentAlive: boolean;
  totalEpochs: number;
  totalProposals: number;
  totalPromotions: number;
  testsPassed: number;
  testsTotal: number;
}

export interface DashboardState {
  receipt: Receipt;
  mode: ModeState;
  proposals: Proposal[];
  strategies: Strategy[];
  health: SystemHealth;
  contracts: {
    vault: `0x${string}`;
    hook: `0x${string}`;
    poolManager: `0x${string}`;
    explorerBase: string;
  };
  isDemo: boolean;
}
