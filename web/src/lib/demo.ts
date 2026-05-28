import type { DashboardState } from './types';

/**
 * Demo dataset. Designed to look like a healthy, mid-life AgentFloat deployment
 * with one fresh pending proposal (visible auto-approve countdown), one approved
 * and ready to deploy, and one already executed on-chain.
 *
 * Values are tuned so a judge scrolling for 60 seconds sees: a real-money receipt,
 * a tangible mode dial, three different proposal states, and proof of deployed
 * contracts. No interaction required.
 */
export function getDemoState(): DashboardState {
  const now = Date.now();
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;

  return {
    receipt: {
      earnedUsd: 47.23,
      daysActive: 14,
      strategiesTested: 3,
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0FaEd',
      hasData: true,
    },
    mode: {
      current: 'review',
      autoApproveAfterHours: 1,
      guardrails: {
        maxProposalsPerDay: 10,
        maxStrategiesRegistered: 5,
        pinnedStrategyIds: [1],
        requireSecurityAuditFor: ['new_strategy'],
      },
    },
    proposals: [
      {
        id: '2026-05-27-014-parameter_variant',
        proposedAt: new Date(now - 13 * min).toISOString(),
        model: 'llama-3.3-70b-versatile',
        actionType: 'parameter_variant',
        status: 'pending',
        headline: 'Deploy MockYieldStrategy with rate=2bps for higher accrual',
        reasoning:
          'Mock Yield Strategy has shown a 30x performance gap over Idle baseline (mean 112,167 vs 3,251 μbps) over 484 observations. The variance suggests room for a more aggressive accrual rate. Doubling the per-block rate is a low-risk shadow test — if it underperforms, the on-chain promotion guards will catch it before any capital migrates.',
        proposedChange:
          'Deploy a new instance of MockYieldStrategy with RATE_PER_BLOCK_BPS=2 (current shadow uses 1). Register as shadow at strategy_id=4.',
        expectedOutcome:
          'Faster accrual curve. Should win head-to-head against the existing shadow within ~30 epochs at current block cadence.',
        evidence:
          '~/brain/wiki/agentfloat-history.md — Mock Yield σ=91,802 over 484 obs · ~/brain/raw/agentfloat-strategy-scores.md tail',
        risks:
          'If block production stalls, accrual rate is meaningless. Mitigated by the existing scoring formula which uses block-delta math.',
        autoApprovesAt: new Date(now + 47 * min).toISOString(),
        execution: null,
      },
      {
        id: '2026-05-27-013-scoring_change',
        proposedAt: new Date(now - 38 * min).toISOString(),
        model: 'llama-3.3-70b-versatile',
        actionType: 'scoring_change',
        status: 'approved',
        headline: 'Lower minEpochsConsecutive from 5 to 4',
        reasoning:
          'Over 970 score entries, no shadow has been promoted despite the Mock Yield strategy beating Idle in every comparison. The 5-epoch consecutive-win requirement may be too tight given current scoring cadence.',
        proposedChange:
          'Edit ~/brain/wiki/agentfloat-scoring.md config block: set "minEpochsConsecutive": 4',
        expectedOutcome:
          'Promotion latency drops by 20%. Increased churn risk is bounded by minDeltaBps (still 10) and the active-age guard (still 100 epochs).',
        evidence:
          'agentfloat-history.md reports 0 promotions despite consistent shadow outperformance',
        risks: 'Slightly higher promotion frequency in volatile windows. Mitigated by unchanged minDeltaBps.',
        autoApprovesAt: null,
        execution: null,
      },
      {
        id: '2026-05-26-999-parameter_variant',
        proposedAt: new Date(now - 19 * hour).toISOString(),
        model: 'llama-3.3-70b-versatile',
        actionType: 'parameter_variant',
        status: 'executed',
        headline: 'Deploy MockYieldStrategy variant at rate=2bps',
        reasoning:
          'First parameter sweep proposal — establish that the auto-deploy pipeline works end-to-end before proposing more aggressive changes.',
        proposedChange: 'Deploy MockYieldStrategy with RATE_PER_BLOCK_BPS=2.',
        expectedOutcome: 'New shadow scoring against existing strategies starting next epoch.',
        evidence: 'agentfloat-history.md',
        risks: 'Test fixture — retired post-deployment.',
        autoApprovesAt: null,
        execution: {
          txHash: '0x4245ab63dbd189b42bd0ba3882458ca924a777828fb60fe69b0ffa75eb5ff54e',
          deployedAddress: '0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd',
          strategyId: 3,
          executedAt: new Date(now - 18 * hour - 22 * min).toISOString(),
        },
      },
      {
        id: '2026-05-26-008-no_action',
        proposedAt: new Date(now - 2 * day).toISOString(),
        model: 'llama-3.3-70b-versatile',
        actionType: 'no_action',
        status: 'pending_review',
        headline: 'System healthy — no change warranted',
        reasoning:
          'Score variance is within expected bounds. Active strategy holding within design spec. Shadow strategies are accruing as designed. No drift in any metric exceeds noise threshold.',
        proposedChange: 'None — explicit assertion that current state is the right state.',
        expectedOutcome: 'Continuity.',
        evidence: 'Last 240 epochs in agentfloat-history.md',
        risks: 'None.',
        autoApprovesAt: null,
        execution: null,
      },
    ],
    strategies: [
      {
        strategyId: 1,
        name: 'Idle USDC Strategy',
        address: '0x11eC5C3c0A80007a29117604120d82674C9D58B2',
        status: 'active',
        isShadow: false,
        expectedApyBps: 0,
        riskProfile: 'zero',
      },
      {
        strategyId: 2,
        name: 'Mock Yield Strategy',
        address: '0x970D233F4DAB7a4B970Bed33420C38FA14243d00',
        status: 'shadow',
        isShadow: true,
        expectedApyBps: 500,
        riskProfile: 'simulated',
      },
      {
        strategyId: 3,
        name: 'Mock Yield Strategy v3',
        address: '0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd',
        status: 'retired',
        isShadow: true,
        expectedApyBps: 100,
        riskProfile: 'simulated',
      },
    ],
    health: {
      lastEpochAt: new Date(now - 32_000).toISOString(),
      agentAlive: true,
      totalEpochs: 970,
      totalProposals: 14,
      totalPromotions: 0,
      testsPassed: 8,
      testsTotal: 8,
    },
    contracts: {
      vault: '0xbF06de108735332D1EDb81C7A77A750DD428a6f4',
      hook: '0x5Ba6671e8219C34edA373BF95895306929174580',
      poolManager: '0x360e68faccca8ca495c1b759fd9eee466db9fb32',
      explorerBase: 'https://www.oklink.com/xlayer',
    },
    isDemo: true,
  };
}
