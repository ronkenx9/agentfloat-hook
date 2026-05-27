/**
 * Two layers of config:
 *
 *   1. Transport (env vars) — RPC URL, contract addresses, private keys.
 *      Things that change per deployment. Stay in .env.
 *
 *   2. Operational (brain) — scoring rules, strategy specs, promotion thresholds.
 *      Things that change per strategy or per policy decision. Read from
 *      ~/brain/wiki/agentfloat-scoring.md and ~/brain/skills/agentfloat-strategies/.
 *
 * This separation means a non-technical operator can change scoring rules or
 * pause a strategy by editing markdown — no rebuild, no restart of the agent
 * process (it re-reads on every epoch tick).
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { loadScoringRules, loadStrategySpecs } from './brain';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { decrypt } from './crypto';

// Decrypt promoter private key if it is encrypted in .env
let derivedPromoterKey = process.env.PROMOTER_PRIVATE_KEY;
if (derivedPromoterKey && derivedPromoterKey.includes(':')) {
  const password = process.env.DECRYPTION_PASSWORD;
  if (!password) {
    throw new Error('PROMOTER_PRIVATE_KEY is encrypted but DECRYPTION_PASSWORD is not set in .env');
  }
  try {
    derivedPromoterKey = decrypt(derivedPromoterKey, password);
  } catch (err) {
    throw new Error(`Failed to decrypt PROMOTER_PRIVATE_KEY: ${(err as Error).message}`);
  }
}

// Transport-level config — sourced from env
export const TRANSPORT = {
  rpcUrl: process.env.X_LAYER_RPC_URL || 'https://testrpc.xlayer.tech/terigon',
  chainId: parseInt(process.env.X_LAYER_CHAIN_ID || '1952', 10),
  vaultAddress: (process.env.VAULT_ADDRESS || '0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f') as `0x${string}`,
  hookAddress: (process.env.HOOK_ADDRESS || '0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F') as `0x${string}`,
  promoterPrivateKey: derivedPromoterKey as `0x${string}` | undefined,
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
};

/**
 * Snapshot of the operational config — read fresh from the brain on every epoch.
 * Mutations to markdown files take effect on the next call.
 */
export function loadOperationalConfig() {
  return {
    scoring: loadScoringRules(),
    strategies: loadStrategySpecs(),
  };
}

// Back-compat shim — existing imports still work.
// New code should use TRANSPORT + loadOperationalConfig() instead.
const opCfg = loadOperationalConfig();
export const CONFIG = {
  ...TRANSPORT,
  promoterPrivateKey: TRANSPORT.promoterPrivateKey || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  minEpochsToPromote: opCfg.scoring.minEpochsConsecutive,
  minDeltaBps: opCfg.scoring.minDeltaBps,
};
