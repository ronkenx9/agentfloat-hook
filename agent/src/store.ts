/**
 * SQLite read-replica of the brain. The agent writes here on every epoch tick
 * (alongside brain markdown writes). The API reads from here.
 *
 * Markdown remains the source of truth for ops; SQLite is the queryable copy
 * that's safe to deploy alongside the API in a stateless environment.
 *
 * Schema is deliberately denormalized — proposals and strategies carry their
 * full state so the API can return everything in one query.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { loadStrategySpecs, loadOperatingMode } from './brain';

const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');
const DB_PATH = process.env.AGENTFLOAT_DB || path.join(BRAIN_PATH, '.agentfloat.db');

let _db: Database.Database | null = null;
function db(): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  initSchema(_db);
  return _db;
}

function initSchema(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      proposed_at TEXT NOT NULL,
      model TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL,
      headline TEXT NOT NULL,
      reasoning TEXT,
      proposed_change TEXT,
      expected_outcome TEXT,
      evidence TEXT,
      risks TEXT,
      decided_at TEXT,
      decided_by TEXT,
      decision_reason TEXT,
      executed_at TEXT,
      executed_tx TEXT,
      deployed_address TEXT,
      strategy_id INTEGER,
      source_file TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS strategies (
      strategy_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL,
      is_shadow INTEGER NOT NULL,
      expected_apy_bps INTEGER,
      risk_profile TEXT,
      paused INTEGER NOT NULL,
      description TEXT,
      source_file TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      epoch INTEGER NOT NULL,
      strategy_id INTEGER NOT NULL,
      strategy_name TEXT,
      score INTEGER NOT NULL,
      is_active INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scores_strategy_ts ON scores(strategy_id, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_scores_ts ON scores(ts DESC);

    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rejections (
      proposal_id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_nonces (
      nonce TEXT PRIMARY KEY,
      wallet TEXT,
      created_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
  `);
}

// ─── Public API ───────────────────────────────────────────────────────────

export function setSystemState(key: string, value: string) {
  db()
    .prepare(
      'INSERT INTO system_state(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
    )
    .run(key, value);
}

export function getSystemState(key: string): string | null {
  const row = db().prepare('SELECT value FROM system_state WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function insertScore(opts: {
  ts: string;
  epoch: number;
  strategyId: number;
  strategyName: string;
  score: number;
  isActive: boolean;
}) {
  db()
    .prepare(
      'INSERT INTO scores (ts, epoch, strategy_id, strategy_name, score, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(opts.ts, opts.epoch, opts.strategyId, opts.strategyName, opts.score, opts.isActive ? 1 : 0);
}

export function getRecentScores(limit = 100) {
  return db().prepare('SELECT ts, epoch, strategy_id, strategy_name, score, is_active FROM scores ORDER BY id DESC LIMIT ?').all(limit);
}

export function getScoreCount(): number {
  const row = db().prepare('SELECT COUNT(*) as n FROM scores').get() as { n: number };
  return row.n;
}

export function getLastScoreTs(): string | null {
  const row = db().prepare('SELECT ts FROM scores ORDER BY id DESC LIMIT 1').get() as
    | { ts: string }
    | undefined;
  return row?.ts ?? null;
}

// ─── Sync from brain markdown ─────────────────────────────────────────────

function extractSection(body: string, heading: string): string {
  const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
  const m = body.match(re);
  return m ? m[1].trim() : '';
}

export function syncFromBrain() {
  const d = db();

  // Strategies
  const strategies = loadStrategySpecs();
  const upsertStrategy = d.prepare(`
    INSERT INTO strategies (
      strategy_id, name, address, status, is_shadow, expected_apy_bps,
      risk_profile, paused, description, source_file, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(strategy_id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      status = excluded.status,
      is_shadow = excluded.is_shadow,
      expected_apy_bps = excluded.expected_apy_bps,
      risk_profile = excluded.risk_profile,
      paused = excluded.paused,
      description = excluded.description,
      source_file = excluded.source_file,
      updated_at = CURRENT_TIMESTAMP
  `);
  for (const s of strategies) {
    upsertStrategy.run(
      s.strategy_id,
      s.name,
      s.contract_address,
      s.status,
      s.is_shadow ? 1 : 0,
      s.expected_apy_bps,
      s.risk_profile,
      s.paused ? 1 : 0,
      s.description,
      s.sourceFile,
    );
  }

  // Proposals
  const proposalsDir = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies', 'proposals');
  if (fs.existsSync(proposalsDir)) {
    const upsertProposal = d.prepare(`
      INSERT INTO proposals (
        id, proposed_at, model, action_type, status, headline,
        reasoning, proposed_change, expected_outcome, evidence, risks,
        decided_at, decided_by, decision_reason,
        executed_at, executed_tx, deployed_address, strategy_id,
        source_file, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        decided_at = excluded.decided_at,
        decided_by = excluded.decided_by,
        decision_reason = excluded.decision_reason,
        executed_at = excluded.executed_at,
        executed_tx = excluded.executed_tx,
        deployed_address = excluded.deployed_address,
        strategy_id = excluded.strategy_id,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const f of fs.readdirSync(proposalsDir)) {
      if (!f.endsWith('.md') || f === 'README.md') continue;
      const filepath = path.join(proposalsDir, f);
      try {
        const raw = fs.readFileSync(filepath, 'utf8');
        const parsed = matter(raw);
        const fm = parsed.data;
        const body = parsed.content;

        upsertProposal.run(
          path.basename(f, '.md'),
          fm.proposed_at || new Date(0).toISOString(),
          fm.model || 'unknown',
          fm.action_type || 'no_action',
          fm.status || 'pending',
          fm.headline || '(no headline)',
          extractSection(body, 'Reasoning'),
          extractSection(body, 'Proposed change'),
          extractSection(body, 'Expected outcome'),
          extractSection(body, 'Evidence'),
          extractSection(body, 'Risks'),
          fm.decided_at || null,
          fm.decided_by || null,
          fm.decision_reason || null,
          fm.executed_at || null,
          fm.executed_tx || null,
          fm.deployed_address || null,
          typeof fm.strategy_id === 'number' ? fm.strategy_id : null,
          filepath,
        );
      } catch (err) {
        console.warn(`[store] skipped ${f}: ${(err as Error).message}`);
      }
    }
  }

  // Mode
  const mode = loadOperatingMode();
  setSystemState('mode', JSON.stringify(mode));

  return { strategies: strategies.length };
}

// ─── Read API used by the dashboard server ────────────────────────────────

export function getAllProposals() {
  return db().prepare('SELECT * FROM proposals ORDER BY proposed_at DESC').all();
}

export function getProposalById(id: string) {
  return db().prepare('SELECT * FROM proposals WHERE id = ?').get(id);
}

export function getAllStrategies() {
  return db().prepare('SELECT * FROM strategies ORDER BY strategy_id ASC').all();
}

// ─── Auth nonces (used by SIWE flow) ──────────────────────────────────────

export function createAuthNonce(nonce: string): void {
  db().prepare('INSERT INTO auth_nonces (nonce, created_at) VALUES (?, ?)').run(nonce, Date.now());
}

export function consumeAuthNonce(nonce: string): boolean {
  const row = db()
    .prepare('SELECT created_at, used FROM auth_nonces WHERE nonce = ?')
    .get(nonce) as { created_at: number; used: number } | undefined;
  if (!row || row.used) return false;
  if (Date.now() - row.created_at > 10 * 60 * 1000) return false;
  db().prepare('UPDATE auth_nonces SET used = 1 WHERE nonce = ?').run(nonce);
  return true;
}

// ─── Rejections ───────────────────────────────────────────────────────────

export function recordRejection(proposalId: string, wallet: string, reason: string) {
  db()
    .prepare(
      'INSERT INTO rejections (proposal_id, wallet, reason) VALUES (?, ?, ?) ON CONFLICT(proposal_id) DO UPDATE SET wallet = excluded.wallet, reason = excluded.reason',
    )
    .run(proposalId, wallet, reason);
}

export function getRejection(proposalId: string) {
  return db().prepare('SELECT * FROM rejections WHERE proposal_id = ?').get(proposalId);
}

export default { db, syncFromBrain };
