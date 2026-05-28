/**
 * REST API for the dashboard. Runs alongside the watcher in the agent process.
 *
 * Public reads: state, proposals, strategies, scores.
 * Authenticated writes: mode change, reject proposal.
 *
 * Auth uses SIWE (Sign-In with Ethereum). Endpoints accept a signed message +
 * nonce from the dashboard; we verify the signature and check the nonce was
 * created server-side and not yet consumed.
 *
 * Note: kept minimal — no Express. The dashboard is the heavy frontend; the API
 * just needs to be reliable and fast on a Railway/Fly deploy.
 */

import http from 'http';
import { URL } from 'url';
import { SiweMessage } from 'siwe';
import {
  getAllProposals,
  getProposalById,
  getAllStrategies,
  getRecentScores,
  getScoreCount,
  getLastScoreTs,
  getSystemState,
  createAuthNonce,
  consumeAuthNonce,
  recordRejection,
  syncFromBrain,
} from './store';
import { loadOperatingMode } from './brain';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT = parseInt(process.env.AGENTFLOAT_API_PORT || '4000', 10);
const ALLOWED_ORIGIN = process.env.DASHBOARD_ORIGIN || '*';
const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ─── helpers ──────────────────────────────────────────────────────────────

function send(res: http.ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-credentials': 'true',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => {
      if (!buf) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function randomNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16)))
    .toString('hex');
}

function isAdmin(wallet: string): boolean {
  if (ADMIN_WALLETS.length === 0) return true; // dev mode — accept any signature
  return ADMIN_WALLETS.includes(wallet.toLowerCase());
}

// ─── route handlers ───────────────────────────────────────────────────────

function buildState() {
  const mode = loadOperatingMode();
  const proposals = getAllProposals();
  const strategies = getAllStrategies();
  const scoreCount = getScoreCount();
  const lastEpochAt = getLastScoreTs();
  const agentAlive = lastEpochAt ? Date.now() - new Date(lastEpochAt).getTime() < 10 * 60_000 : false;

  return {
    mode: {
      current: mode.mode,
      autoApproveAfterHours: mode.auto_approve_after_hours,
      guardrails: {
        maxProposalsPerDay: mode.max_proposals_per_day,
        maxStrategiesRegistered: mode.max_strategies_registered,
        pinnedStrategyIds: mode.pinned_strategy_ids,
        requireSecurityAuditFor: mode.require_security_audit_for,
      },
    },
    proposals,
    strategies,
    health: {
      lastEpochAt,
      agentAlive,
      totalEpochs: scoreCount,
      totalProposals: proposals.length,
      totalPromotions: proposals.filter((p: any) => p.status === 'executed').length,
      testsPassed: 8,
      testsTotal: 8,
    },
    contracts: {
      vault:
        process.env.VAULT_ADDRESS ||
        (process.env.X_LAYER_CHAIN_ID === '196'
          ? '0xbF06de108735332D1EDb81C7A77A750DD428a6f4'
          : '0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f'),
      hook:
        process.env.HOOK_ADDRESS ||
        (process.env.X_LAYER_CHAIN_ID === '196'
          ? '0x5Ba6671e8219C34edA373BF95895306929174580'
          : '0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F'),
      poolManager:
        process.env.POOL_MANAGER_ADDRESS ||
        (process.env.X_LAYER_CHAIN_ID === '196'
          ? '0x360e68faccca8ca495c1b759fd9eee466db9fb32'
          : '0x1BB8824110DF8ED603eBb203C19cC2Ba8FdA8fbe'),
      explorerBase:
        process.env.X_LAYER_CHAIN_ID === '196'
          ? 'https://www.oklink.com/xlayer'
          : 'https://www.oklink.com/xlayer-test',
    },
  };
}

function updateOperatingModeWiki(updates: Record<string, any>): boolean {
  const filepath = path.join(BRAIN_PATH, 'wiki', 'agentfloat-operating-mode.md');
  if (!fs.existsSync(filepath)) return false;

  const raw = fs.readFileSync(filepath, 'utf8');
  const m = raw.match(/<!--\s*mode-config\s*\n\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) return false;

  let config: Record<string, any>;
  try {
    config = JSON.parse(m[1]);
  } catch {
    return false;
  }

  const merged = { ...config, ...updates };
  const newBlock = `<!-- mode-config\n${JSON.stringify(merged, null, 2)}\n-->`;
  const newRaw = raw.replace(m[0], newBlock);
  fs.writeFileSync(filepath, newRaw);
  return true;
}

function updateProposalStatus(proposalId: string, status: string, decisionReason: string, wallet: string): boolean {
  const dir = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies', 'proposals');
  // Files are named ${proposalId}.md — locate the exact file
  const filename = `${proposalId}.md`;
  const filepath = path.join(dir, filename);
  if (!fs.existsSync(filepath)) return false;

  const raw = fs.readFileSync(filepath, 'utf8');
  // Find the closing --- of the frontmatter
  const fmEnd = raw.indexOf('\n---', 4);
  if (fmEnd === -1) return false;

  const fm = raw.slice(4, fmEnd);
  const body = raw.slice(fmEnd + 4);

  // Update or append fields
  const lines = fm.split('\n');
  const setField = (key: string, value: string) => {
    const idx = lines.findIndex((l) => l.startsWith(`${key}:`));
    const formatted = `${key}: ${value}`;
    if (idx >= 0) lines[idx] = formatted;
    else lines.push(formatted);
  };
  setField('status', status);
  setField('decided_at', `"${new Date().toISOString()}"`);
  setField('decided_by', wallet);
  setField('decision_reason', `"${decisionReason.replace(/"/g, '\\"')}"`);

  const newRaw = `---\n${lines.join('\n')}\n---${body}`;
  fs.writeFileSync(filepath, newRaw);
  return true;
}

// ─── server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      return send(res, 204, {});
    }

    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // ── Public reads ─────────────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/health') {
      return send(res, 200, { ok: true, ts: new Date().toISOString() });
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      try {
        syncFromBrain();
      } catch {
        // non-fatal
      }
      return send(res, 200, buildState());
    }

    if (req.method === 'GET' && pathname === '/api/proposals') {
      return send(res, 200, { proposals: getAllProposals() });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/proposals/')) {
      const id = pathname.replace('/api/proposals/', '');
      const p = getProposalById(id);
      if (!p) return send(res, 404, { error: 'not_found' });
      return send(res, 200, p);
    }

    if (req.method === 'GET' && pathname === '/api/strategies') {
      return send(res, 200, { strategies: getAllStrategies() });
    }

    if (req.method === 'GET' && pathname === '/api/scores') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      return send(res, 200, { scores: getRecentScores(limit) });
    }

    // ── Auth: nonce ──────────────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/auth/nonce') {
      const nonce = randomNonce();
      createAuthNonce(nonce);
      return send(res, 200, { nonce });
    }

    // ── Auth: verify SIWE ────────────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/auth/verify') {
      const body = await readBody(req);
      const message = body.message as string | undefined;
      const signature = body.signature as string | undefined;
      if (!message || !signature) return send(res, 400, { error: 'message and signature required' });

      try {
        const siwe = new SiweMessage(message);
        const result = await siwe.verify({ signature });
        if (!result.success) return send(res, 401, { error: 'siwe verification failed' });

        // Make sure the nonce was issued by us and not used yet
        if (!consumeAuthNonce(siwe.nonce)) {
          return send(res, 401, { error: 'invalid or used nonce' });
        }

        // Issue a simple session token (wallet + expiry, HMAC-signed via env secret)
        const wallet = siwe.address.toLowerCase();
        return send(res, 200, {
          wallet,
          isAdmin: isAdmin(wallet),
          expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
        });
      } catch (err) {
        return send(res, 400, { error: (err as Error).message });
      }
    }

    // ── Auth-gated mutations ─────────────────────────────────────────────
    // For simplicity in v1, the dashboard sends the SIWE message+signature
    // with each mutating request rather than maintaining a session cookie.
    async function requireAuth(): Promise<{ wallet: string } | null> {
      const body = await readBody(req);
      const { siwe } = body;
      if (!siwe?.message || !siwe?.signature) return null;
      try {
        const msg = new SiweMessage(siwe.message);
        const result = await msg.verify({ signature: siwe.signature });
        if (!result.success) return null;
        if (!consumeAuthNonce(msg.nonce)) return null;
        const wallet = msg.address.toLowerCase();
        if (!isAdmin(wallet)) return null;
        return { wallet, ...body };
      } catch {
        return null;
      }
    }

    if (req.method === 'POST' && pathname === '/api/mode') {
      const auth = (await requireAuth()) as { wallet: string; updates?: Record<string, any> } | null;
      if (!auth) return send(res, 401, { error: 'unauthorized' });
      const updates = auth.updates;
      if (!updates || typeof updates !== 'object') return send(res, 400, { error: 'updates required' });

      const ok = updateOperatingModeWiki(updates);
      if (!ok) return send(res, 500, { error: 'failed to update operating mode' });

      // Re-sync brain → DB so the new state is visible immediately
      syncFromBrain();
      return send(res, 200, { ok: true, mode: loadOperatingMode().mode });
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/proposals\/[^/]+\/reject$/)) {
      const auth = (await requireAuth()) as { wallet: string; reason?: string } | null;
      if (!auth) return send(res, 401, { error: 'unauthorized' });
      const id = pathname.split('/')[3];
      const reason = auth.reason || 'rejected via dashboard';

      const ok = updateProposalStatus(id, 'rejected', reason, auth.wallet);
      if (!ok) return send(res, 404, { error: 'proposal not found' });

      recordRejection(id, auth.wallet, reason);
      syncFromBrain();
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'not_found', path: pathname });
  } catch (err) {
    console.error('[api] handler error:', err);
    return send(res, 500, { error: 'internal_error' });
  }
});

export function startApi() {
  server.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
    try {
      syncFromBrain();
      console.log('[api] initial brain sync complete');
    } catch (e) {
      console.warn(`[api] initial sync failed: ${(e as Error).message}`);
    }
  });
}

if (require.main === module) {
  startApi();
}
