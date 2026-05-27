/**
 * API client. Talks to the agent's REST API at AGENT_API_URL.
 * In development, defaults to localhost:4000.
 */

import type { DashboardState, Proposal, Strategy } from './types';

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || process.env.AGENT_API_URL || 'http://localhost:4000';

interface ApiState {
  mode: DashboardState['mode'];
  proposals: any[];
  strategies: any[];
  health: DashboardState['health'];
  contracts: DashboardState['contracts'];
}

function mapProposal(p: any, mode: DashboardState['mode']): Proposal {
  let autoApprovesAt: string | null = null;
  if (
    p.status === 'pending' &&
    mode.current === 'review' &&
    mode.autoApproveAfterHours !== null &&
    typeof p.proposed_at === 'string'
  ) {
    const proposedAt = new Date(p.proposed_at).getTime();
    autoApprovesAt = new Date(proposedAt + mode.autoApproveAfterHours * 3_600_000).toISOString();
  }

  return {
    id: p.id,
    proposedAt: p.proposed_at,
    model: p.model,
    actionType: p.action_type,
    status: p.status,
    headline: p.headline,
    reasoning: p.reasoning || '',
    proposedChange: p.proposed_change || '',
    expectedOutcome: p.expected_outcome || '',
    evidence: p.evidence || '',
    risks: p.risks || '',
    autoApprovesAt,
    execution:
      p.executed_at || p.executed_tx
        ? {
            txHash: p.executed_tx || null,
            deployedAddress: p.deployed_address || null,
            strategyId: typeof p.strategy_id === 'number' ? p.strategy_id : null,
            executedAt: p.executed_at || null,
          }
        : null,
  };
}

function mapStrategy(s: any): Strategy {
  return {
    strategyId: s.strategy_id,
    name: s.name,
    address: s.address,
    status: s.status,
    isShadow: !!s.is_shadow,
    expectedApyBps: s.expected_apy_bps || 0,
    riskProfile: s.risk_profile,
  };
}

export async function fetchState(): Promise<DashboardState | null> {
  try {
    const r = await fetch(`${API_BASE}/api/state`, { cache: 'no-store' });
    if (!r.ok) return null;
    const data = (await r.json()) as ApiState;

    return {
      receipt: {
        earnedUsd: 0,
        daysActive: 0,
        strategiesTested: data.strategies.length,
        wallet: null,
        hasData: false,
      },
      mode: data.mode,
      proposals: data.proposals.map((p) => mapProposal(p, data.mode)),
      strategies: data.strategies.map(mapStrategy),
      health: data.health,
      contracts: data.contracts,
      isDemo: false,
    };
  } catch (err) {
    console.warn('[api] fetchState failed:', err);
    return null;
  }
}

export async function fetchNonce(): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/api/auth/nonce`);
    if (!r.ok) return null;
    const data = await r.json();
    return data.nonce;
  } catch {
    return null;
  }
}

export async function postMode(siweMessage: string, siweSignature: string, updates: Record<string, any>) {
  const r = await fetch(`${API_BASE}/api/mode`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siwe: { message: siweMessage, signature: siweSignature }, updates }),
  });
  return r.json();
}

export async function postReject(proposalId: string, siweMessage: string, siweSignature: string, reason: string) {
  const r = await fetch(`${API_BASE}/api/proposals/${proposalId}/reject`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siwe: { message: siweMessage, signature: siweSignature }, reason }),
  });
  return r.json();
}

export const API_URL = API_BASE;

export interface EventItem {
  ts: string;
  kind: "score" | "promotion" | "proposal" | "execution";
  text: string;
  strategyId?: number;
  txHash?: `0x${string}`;
}

/**
 * Synthesize a recent-events feed from existing API endpoints.
 * Score events come from /api/scores; promotion/proposal events come from /api/proposals.
 */
export async function fetchRecentEvents(limit = 12): Promise<EventItem[]> {
  try {
    const [scoresRes, propsRes] = await Promise.all([
      fetch(`${API_BASE}/api/scores?limit=8`, { cache: "no-store" }),
      fetch(`${API_BASE}/api/proposals`, { cache: "no-store" }),
    ]);

    const events: EventItem[] = [];

    if (scoresRes.ok) {
      const data = await scoresRes.json();
      for (const s of data.scores ?? []) {
        events.push({
          ts: s.ts,
          kind: "score",
          text: `${s.strategy_name} scored ${Number(s.score).toLocaleString()} μbps`,
          strategyId: s.strategy_id,
        });
      }
    }

    if (propsRes.ok) {
      const data = await propsRes.json();
      for (const p of data.proposals ?? []) {
        if (p.executed_at) {
          events.push({
            ts: p.executed_at,
            kind: "execution",
            text: `Shipped: ${truncate(p.headline, 60)}`,
            txHash: p.executed_tx,
          });
        } else if (p.decided_at && p.status === "approved") {
          events.push({
            ts: p.decided_at,
            kind: "promotion",
            text: `Approved: ${truncate(p.headline, 60)}`,
          });
        } else {
          events.push({
            ts: p.proposed_at,
            kind: "proposal",
            text: `Proposed: ${truncate(p.headline, 60)}`,
          });
        }
      }
    }

    return events
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, limit);
  } catch {
    return [];
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
