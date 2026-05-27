/**
 * Consolidator — turns raw score logs + journal promotion events into the
 * brain's actual understanding at `~/brain/wiki/agentfloat-history.md`.
 *
 * The agent is real-time operational; the consolidator is analytical
 * reflection. Run it on demand or via cron — it's idempotent and overwrites
 * the history wiki article each time.
 *
 * Run with: `npm run consolidate` (see package.json)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadStrategySpecs, type StrategySpec } from './brain';

const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');

// ─── Types ────────────────────────────────────────────────────────────────

interface ScoreEntry {
  timestamp: Date;
  epoch: number;
  strategyId: number;
  strategyName: string;
  score: number;
  isActive: boolean;
}

interface PromotionEvent {
  date: string;
  fromStrategyId: number;
  fromStrategyName: string;
  toStrategyId: number;
  toStrategyName: string;
  blockNumber: bigint;
  txHash: string;
  scoreDelta: number;
  consecutiveEpochs: number;
}

interface StrategyStats {
  spec: StrategySpec | undefined;
  strategyId: number;
  strategyName: string;
  totalObservations: number;
  firstSeen: Date;
  lastSeen: Date;
  scoreMean: number;
  scoreStdDev: number;
  scoreMin: number;
  scoreMax: number;
  epochsAsActive: number;
  epochsAsShadow: number;
  // Head-to-head: how often did this strategy beat the active strategy when it was a shadow
  shadowWinsAgainstActive: number;
  shadowComparisonsAgainstActive: number;
}

// ─── Parsers ──────────────────────────────────────────────────────────────

const SCORE_LINE_RE =
  /^\[([\d:\- ]+)\]\s+epoch=(\d+)\s+strategy=(\d+)\s+\(([^)]+)\)\s+score=(-?\d+(?:\.\d+)?)\s+active=(true|false)\s*$/;

function parseScoreLog(filepath: string): ScoreEntry[] {
  if (!fs.existsSync(filepath)) return [];
  const raw = fs.readFileSync(filepath, 'utf8');
  const entries: ScoreEntry[] = [];
  for (const line of raw.split('\n')) {
    const m = line.match(SCORE_LINE_RE);
    if (!m) continue;
    entries.push({
      timestamp: new Date(m[1].replace(' ', 'T') + 'Z'),
      epoch: parseInt(m[2], 10),
      strategyId: parseInt(m[3], 10),
      strategyName: m[4],
      score: parseFloat(m[5]),
      isActive: m[6] === 'true',
    });
  }
  return entries;
}

// Promotion events written by `brain.ts:logPromotion()` use a structured
// markdown block. Parse them out of journal files.
const PROMO_BLOCK_RE = /## AgentFloat promotion\s+([\s\S]*?)(?=\n## |\n$)/g;

function parsePromotionsFromJournal(filepath: string): PromotionEvent[] {
  if (!fs.existsSync(filepath)) return [];
  const raw = fs.readFileSync(filepath, 'utf8');
  const date = path.basename(filepath, '.md');
  const events: PromotionEvent[] = [];

  let match;
  while ((match = PROMO_BLOCK_RE.exec(raw)) !== null) {
    const body = match[1];
    const get = (key: string) => {
      const re = new RegExp(`\\*\\*${key}:\\*\\*\\s+(.+)$`, 'm');
      const m = body.match(re);
      return m ? m[1].trim() : '';
    };

    const fromLine = get('From');
    const toLine = get('To');
    const fromMatch = fromLine.match(/\[(\d+)\]\s+(.+)/);
    const toMatch = toLine.match(/\[(\d+)\]\s+(.+)/);
    if (!fromMatch || !toMatch) continue;

    events.push({
      date,
      fromStrategyId: parseInt(fromMatch[1], 10),
      fromStrategyName: fromMatch[2],
      toStrategyId: parseInt(toMatch[1], 10),
      toStrategyName: toMatch[2],
      blockNumber: BigInt(get('Block') || '0'),
      txHash: get('Tx'),
      scoreDelta: parseFloat(get('Score delta').replace(/[^-\d.]/g, '')) || 0,
      consecutiveEpochs: parseInt(get('Consecutive epochs') || '0', 10),
    });
  }
  return events;
}

function loadAllPromotions(): PromotionEvent[] {
  const journalDir = path.join(BRAIN_PATH, 'journal');
  if (!fs.existsSync(journalDir)) return [];
  const all: PromotionEvent[] = [];
  for (const file of fs.readdirSync(journalDir)) {
    if (!file.endsWith('.md')) continue;
    all.push(...parsePromotionsFromJournal(path.join(journalDir, file)));
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Statistics ───────────────────────────────────────────────────────────

function computeStats(entries: ScoreEntry[], specs: StrategySpec[]): StrategyStats[] {
  const specsById = new Map(specs.map((s) => [s.strategy_id, s]));
  const grouped = new Map<number, ScoreEntry[]>();
  for (const entry of entries) {
    if (!grouped.has(entry.strategyId)) grouped.set(entry.strategyId, []);
    grouped.get(entry.strategyId)!.push(entry);
  }

  // For head-to-head comparison: for each epoch, find the active strategy's score
  const activeScoresByEpoch = new Map<number, number>();
  for (const entry of entries) {
    if (entry.isActive) activeScoresByEpoch.set(entry.epoch, entry.score);
  }

  const stats: StrategyStats[] = [];
  for (const [strategyId, strategyEntries] of grouped) {
    const scores = strategyEntries.map((e) => e.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    let shadowWins = 0;
    let shadowComparisons = 0;
    for (const entry of strategyEntries) {
      if (entry.isActive) continue;
      const activeScore = activeScoresByEpoch.get(entry.epoch);
      if (activeScore === undefined) continue;
      shadowComparisons += 1;
      if (entry.score > activeScore) shadowWins += 1;
    }

    stats.push({
      spec: specsById.get(strategyId),
      strategyId,
      strategyName: specsById.get(strategyId)?.name || strategyEntries[strategyEntries.length - 1].strategyName,
      totalObservations: strategyEntries.length,
      firstSeen: strategyEntries[0].timestamp,
      lastSeen: strategyEntries[strategyEntries.length - 1].timestamp,
      scoreMean: mean,
      scoreStdDev: stdDev,
      scoreMin: Math.min(...scores),
      scoreMax: Math.max(...scores),
      epochsAsActive: strategyEntries.filter((e) => e.isActive).length,
      epochsAsShadow: strategyEntries.filter((e) => !e.isActive).length,
      shadowWinsAgainstActive: shadowWins,
      shadowComparisonsAgainstActive: shadowComparisons,
    });
  }
  return stats.sort((a, b) => a.strategyId - b.strategyId);
}

// ─── Pattern detection ────────────────────────────────────────────────────

interface Observation {
  category: 'pattern' | 'anomaly' | 'health';
  severity: 'info' | 'warn' | 'error';
  message: string;
}

/**
 * Detects whether the active strategy flag has flipped between strategies
 * within the observed entries — useful for spotting on-chain promotions that
 * were never journaled (consistency gap).
 */
function detectActiveFlipsWithoutJournal(entries: ScoreEntry[], promotions: PromotionEvent[]): number {
  // Walk entries in time order; count transitions in the "currently active strategy id"
  let lastActiveId: number | null = null;
  let flips = 0;
  for (const entry of entries) {
    if (entry.isActive) {
      if (lastActiveId !== null && lastActiveId !== entry.strategyId) {
        flips += 1;
      }
      lastActiveId = entry.strategyId;
    }
  }
  return Math.max(0, flips - promotions.length);
}

function observePatterns(stats: StrategyStats[], promotions: PromotionEvent[], entries: ScoreEntry[]): Observation[] {
  const out: Observation[] = [];

  if (entries.length === 0) {
    out.push({ category: 'health', severity: 'warn', message: 'No score entries recorded yet — agent may not have run.' });
    return out;
  }

  // ── Health: recent activity ────────────────────────────────────────────
  const latestEntry = entries[entries.length - 1];
  const minutesSinceLastScore = (Date.now() - latestEntry.timestamp.getTime()) / 60000;
  if (minutesSinceLastScore > 120) {
    out.push({
      category: 'health',
      severity: 'warn',
      message: `Last score entry is ${Math.floor(minutesSinceLastScore)} minutes old — agent may be offline.`,
    });
  } else {
    out.push({
      category: 'health',
      severity: 'info',
      message: `Agent is active — last score ${Math.floor(minutesSinceLastScore)} minutes ago.`,
    });
  }

  // ── Per-strategy patterns (class-aware) ────────────────────────────────
  for (const s of stats) {
    const isBaseline = s.spec?.risk_profile === 'zero';

    if (s.shadowComparisonsAgainstActive > 0) {
      const winRate = (s.shadowWinsAgainstActive / s.shadowComparisonsAgainstActive) * 100;

      if (winRate >= 80 && s.shadowComparisonsAgainstActive >= 20) {
        out.push({
          category: 'pattern',
          severity: 'info',
          message: `Strategy ${s.strategyId} (${s.strategyName}) wins ${winRate.toFixed(0)}% of head-to-head epochs as shadow — strong promotion candidate.`,
        });
      } else if (winRate < 20 && s.shadowComparisonsAgainstActive >= 20 && !isBaseline) {
        // Don't suggest retiring baseline strategies — they're floor by design
        out.push({
          category: 'pattern',
          severity: 'info',
          message: `Strategy ${s.strategyId} (${s.strategyName}) wins only ${winRate.toFixed(0)}% of head-to-head epochs — consider retiring.`,
        });
      } else if (winRate < 20 && isBaseline) {
        out.push({
          category: 'pattern',
          severity: 'info',
          message: `Strategy ${s.strategyId} (${s.strategyName}) is the baseline floor (risk_profile=zero) — low win rate is expected behavior.`,
        });
      }
    }

    // Anomaly: zero variance over a lot of observations
    if (s.totalObservations > 30 && s.scoreStdDev === 0) {
      out.push({
        category: 'anomaly',
        severity: 'warn',
        message: `Strategy ${s.strategyId} (${s.strategyName}) has zero score variance over ${s.totalObservations} observations — scoring may be stubbed${isBaseline ? ' (expected for baseline)' : ''}.`,
      });
    }

    // Anomaly: extreme score range — but expected for accrual-style strategies
    const expectedAccrual = s.spec?.risk_profile === 'simulated' || s.spec?.risk_profile === 'protocol';
    if (s.scoreMax - s.scoreMin > 100000 && s.totalObservations > 10 && !expectedAccrual) {
      out.push({
        category: 'anomaly',
        severity: 'warn',
        message: `Strategy ${s.strategyId} (${s.strategyName}) score range is ${s.scoreMax - s.scoreMin} μbps — high volatility, review.`,
      });
    }

    // Missing brain spec
    if (!s.spec) {
      out.push({
        category: 'anomaly',
        severity: 'warn',
        message: `Strategy ${s.strategyId} (${s.strategyName}) has no brain spec at ~/brain/skills/agentfloat-strategies/.`,
      });
    } else if (s.spec.paused) {
      out.push({
        category: 'health',
        severity: 'info',
        message: `Strategy ${s.strategyId} (${s.strategyName}) is paused per brain spec.`,
      });
    }
  }

  // ── Promotion cadence ──────────────────────────────────────────────────
  if (promotions.length === 0) {
    out.push({
      category: 'pattern',
      severity: 'info',
      message: 'No promotions executed yet. Either all guards are firing, no shadow has accumulated enough wins, or the active strategy has not aged enough.',
    });
  } else {
    out.push({
      category: 'pattern',
      severity: 'info',
      message: `${promotions.length} promotion(s) executed. Latest: ${promotions[promotions.length - 1].toStrategyName} on ${promotions[promotions.length - 1].date}.`,
    });
  }

  // ── Promotion-stalled detection ────────────────────────────────────────
  // A shadow with high win rate + enough observations that hasn't been promoted = guards firing or thresholds too tight
  for (const s of stats) {
    if (s.shadowComparisonsAgainstActive < 30) continue;
    if (s.spec?.paused || s.spec?.status === 'retired') continue;
    if (s.spec?.risk_profile === 'zero') continue;
    const winRate = (s.shadowWinsAgainstActive / s.shadowComparisonsAgainstActive) * 100;
    if (winRate < 60) continue;
    // Has this strategy been promoted at any point in the journal?
    const wasPromoted = promotions.some((p) => p.toStrategyId === s.strategyId);
    if (!wasPromoted) {
      out.push({
        category: 'anomaly',
        severity: 'warn',
        message: `Strategy ${s.strategyId} (${s.strategyName}) has ${winRate.toFixed(0)}% win rate over ${s.shadowComparisonsAgainstActive} comparisons but has never been promoted — check anti-promotion guards (active-age, revert count) or thresholds in ~/brain/wiki/agentfloat-scoring.md.`,
      });
    }
  }

  // ── Active-flag consistency check ──────────────────────────────────────
  const unaccountedFlips = detectActiveFlipsWithoutJournal(entries, promotions);
  if (unaccountedFlips > 0) {
    out.push({
      category: 'anomaly',
      severity: 'warn',
      message: `Detected ${unaccountedFlips} on-chain active-flag flip(s) that have no matching journal promotion event. Either the old write path didn't journal, or promotions happened outside the structured flow. Verify against the FloatVault.StrategyPromoted event log on-chain.`,
    });
  }

  return out;
}

// ─── Markdown writer ──────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function renderHistory(opts: {
  stats: StrategyStats[];
  promotions: PromotionEvent[];
  observations: Observation[];
  entries: ScoreEntry[];
  scoringSource: string;
}): string {
  const now = new Date();
  const { stats, promotions, observations, entries, scoringSource } = opts;

  let firstEntryTime = 'n/a';
  let lastEntryTime = 'n/a';
  if (entries.length > 0) {
    firstEntryTime = formatDate(entries[0].timestamp);
    lastEntryTime = formatDate(entries[entries.length - 1].timestamp);
  }

  const totalStrategies = stats.length;
  const pausedCount = stats.filter((s) => s.spec?.paused).length;
  const retiredCount = stats.filter((s) => s.spec?.status === 'retired').length;
  const activeEligible = totalStrategies - pausedCount - retiredCount;

  const lines: string[] = [];

  lines.push('# AgentFloat — Operational History');
  lines.push('');
  lines.push('> LLM-maintained by the consolidator. Edits will be overwritten on next run.');
  lines.push(`> Last consolidated: ${formatDate(now)}`);
  lines.push(`> Coverage: ${firstEntryTime} → ${lastEntryTime}`);
  lines.push(`> Score entries analyzed: ${entries.length}`);
  lines.push(`> Scoring rules source: ${scoringSource}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total strategies tracked: **${totalStrategies}** (${activeEligible} eligible, ${pausedCount} paused, ${retiredCount} retired)`);
  lines.push(`- Total epochs scored: **${entries.length}**`);
  lines.push(`- Promotions executed: **${promotions.length}**`);
  lines.push('');

  // Strategy performance
  lines.push('## Strategy Performance');
  lines.push('');
  for (const s of stats) {
    const winRate =
      s.shadowComparisonsAgainstActive > 0
        ? ((s.shadowWinsAgainstActive / s.shadowComparisonsAgainstActive) * 100).toFixed(1) + '%'
        : 'n/a';
    lines.push(`### ${s.strategyName} (id=${s.strategyId})`);
    lines.push('');
    if (s.spec) {
      lines.push(`- **Brain spec:** \`${s.spec.sourceFile.replace(BRAIN_PATH, '~/brain')}\``);
      lines.push(`- **Status:** ${s.spec.status}${s.spec.paused ? ' · ⏸ paused' : ''}`);
      lines.push(`- **Contract:** \`${s.spec.contract_address}\``);
    } else {
      lines.push('- **Brain spec:** _missing — anomaly_');
    }
    lines.push(`- **First observed:** ${formatDate(s.firstSeen)}`);
    lines.push(`- **Last observed:** ${formatDate(s.lastSeen)}`);
    lines.push(`- **Observations:** ${s.totalObservations}`);
    lines.push(`- **Score mean:** ${s.scoreMean.toFixed(0)} μbps (σ=${s.scoreStdDev.toFixed(0)}, min=${s.scoreMin}, max=${s.scoreMax})`);
    lines.push(`- **Time as active:** ${s.epochsAsActive} epochs · **as shadow:** ${s.epochsAsShadow} epochs`);
    lines.push(`- **Shadow win rate vs active:** ${winRate} (${s.shadowWinsAgainstActive}/${s.shadowComparisonsAgainstActive})`);
    lines.push('');
  }

  // Promotion timeline
  lines.push('## Promotion Timeline');
  lines.push('');
  if (promotions.length === 0) {
    lines.push('_No promotions executed yet._');
  } else {
    lines.push('| Date | From | To | Δ Score (μbps) | Consecutive | Tx |');
    lines.push('|------|------|----|----|----|----|');
    for (const p of promotions) {
      const txDisplay = p.txHash ? `[\`${p.txHash.slice(0, 10)}…\`](https://www.oklink.com/xlayer-test/tx/${p.txHash})` : '—';
      lines.push(
        `| ${p.date} | [${p.fromStrategyId}] ${p.fromStrategyName} | [${p.toStrategyId}] ${p.toStrategyName} | ${p.scoreDelta} | ${p.consecutiveEpochs} | ${txDisplay} |`,
      );
    }
  }
  lines.push('');

  // Observations
  const patterns = observations.filter((o) => o.category === 'pattern');
  const anomalies = observations.filter((o) => o.category === 'anomaly');
  const health = observations.filter((o) => o.category === 'health');

  lines.push('## Patterns Observed');
  lines.push('');
  if (patterns.length === 0) lines.push('_None yet._');
  for (const o of patterns) lines.push(`- ${o.message}`);
  lines.push('');

  lines.push('## Anomalies & Review Items');
  lines.push('');
  if (anomalies.length === 0) lines.push('_None flagged._');
  for (const o of anomalies) lines.push(`- ⚠️  ${o.message}`);
  lines.push('');

  lines.push('## System Health');
  lines.push('');
  for (const o of health) lines.push(`- ${o.message}`);
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('## How this article is generated');
  lines.push('');
  lines.push('The consolidator (`agent/src/consolidator.ts`) reads:');
  lines.push('- Raw score log: `~/brain/raw/agentfloat-strategy-scores.md`');
  lines.push('- Promotion events: `~/brain/journal/*.md`');
  lines.push('- Strategy specs: `~/brain/skills/agentfloat-strategies/*.md`');
  lines.push('- Scoring rules: `~/brain/wiki/agentfloat-scoring.md`');
  lines.push('');
  lines.push('Run: `cd ~/Documents/vibecoding/agentfloat-hook/agent && npm run consolidate`');
  lines.push('');
  lines.push('_See also: [[AGENTFLOAT]], [[agentfloat-scoring]]_');

  return lines.join('\n');
}

// ─── Entry point ──────────────────────────────────────────────────────────

export async function consolidate(): Promise<void> {
  console.log('[Consolidator] Reading score log...');
  const entries = parseScoreLog(path.join(BRAIN_PATH, 'raw', 'agentfloat-strategy-scores.md'));
  console.log(`[Consolidator] Parsed ${entries.length} score entries.`);

  console.log('[Consolidator] Reading promotion events from journals...');
  const promotions = loadAllPromotions();
  console.log(`[Consolidator] Found ${promotions.length} promotion events.`);

  console.log('[Consolidator] Loading strategy specs...');
  const specs = loadStrategySpecs();
  console.log(`[Consolidator] Loaded ${specs.length} strategy specs.`);

  const stats = computeStats(entries, specs);
  const observations = observePatterns(stats, promotions, entries);

  const output = renderHistory({
    stats,
    promotions,
    observations,
    entries,
    scoringSource: path.join(BRAIN_PATH, 'wiki', 'agentfloat-scoring.md'),
  });

  const outputPath = path.join(BRAIN_PATH, 'wiki', 'agentfloat-history.md');
  fs.writeFileSync(outputPath, output);
  console.log(`[Consolidator] Wrote ${outputPath} (${output.length} bytes)`);
  console.log(`[Consolidator] Observations: ${observations.length} (${observations.filter((o) => o.severity !== 'info').length} non-info)`);
}

// Run if invoked directly
if (require.main === module) {
  consolidate().catch((err) => {
    console.error('[Consolidator] Fatal:', err);
    process.exit(1);
  });
}
