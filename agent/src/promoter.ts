import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { xLayerTestnetChain, StrategyResult } from './scorer';
import { CONFIG, loadOperationalConfig } from './config';
import { FLOAT_VAULT_ABI } from './abi';
import { logPromotion, StrategySpec } from './brain';

const account = privateKeyToAccount(CONFIG.promoterPrivateKey as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: xLayerTestnetChain,
  transport: http(),
});
const publicClient = createPublicClient({
  chain: xLayerTestnetChain,
  transport: http(),
});

// Consecutive-wins counter per shadow strategy
const winsTracker: { [id: string]: number } = {};
// Track recent revert counts per strategy for anti-promotion guards
const revertTracker: { [id: string]: number } = {};
// Active strategy age in epochs (resets on every promotion)
let activeAgeEpochs = 0;
// Strategy spec lookup — refreshed every cycle from brain
let strategySpecsById: Map<number, StrategySpec> = new Map();

/**
 * Increment active age. Called once per epoch from index.ts.
 */
export function tickActiveAge() {
  activeAgeEpochs += 1;
}

/**
 * Reload strategy specs from the brain. Called at the start of every checkPromotions cycle.
 */
function refreshSpecs() {
  const { strategies } = loadOperationalConfig();
  strategySpecsById = new Map(strategies.map((s) => [s.strategy_id, s]));
}

/**
 * Anti-promotion guards. Returns null if the shadow is eligible, or a reason string if blocked.
 */
function checkGuards(shadow: StrategyResult, scoring: ReturnType<typeof loadOperationalConfig>['scoring']): string | null {
  const spec = strategySpecsById.get(Number(shadow.id));

  if (!spec) {
    return 'no brain spec found — strategy is on-chain but undocumented';
  }

  if (spec.paused) {
    return `spec marked paused in ${spec.sourceFile}`;
  }

  if (spec.status === 'retired') {
    return 'spec marked retired';
  }

  if (activeAgeEpochs < scoring.maxActiveAgeForReplacementEpochs) {
    return `active strategy too young (${activeAgeEpochs}/${scoring.maxActiveAgeForReplacementEpochs} epochs)`;
  }

  const recentReverts = revertTracker[shadow.id.toString()] || 0;
  if (recentReverts >= scoring.maxRevertCount) {
    return `shadow has reverted ${recentReverts} times recently`;
  }

  return null;
}

export async function checkPromotions(results: StrategyResult[]) {
  refreshSpecs();
  const { scoring } = loadOperationalConfig();

  const active = results.find((r) => r.isActive);
  if (!active) {
    console.log('[Promoter] No active strategy found.');
    return;
  }

  const shadows = results.filter((r) => r.isShadow);
  console.log(
    `[Promoter] Comparing ${shadows.length} shadows against active #${active.id} (score: ${active.score}) — thresholds from ${scoring.sourceFile}`,
  );

  for (const shadow of shadows) {
    const scoreDiff = Number(shadow.score - active.score);
    console.log(
      `[Promoter] Shadow #${shadow.id} (${shadow.name}) score: ${shadow.score}, delta: ${scoreDiff} bps`,
    );

    if (scoreDiff >= scoring.minDeltaBps) {
      winsTracker[shadow.id.toString()] = (winsTracker[shadow.id.toString()] || 0) + 1;
      console.log(
        `[Promoter] Shadow #${shadow.id} won epoch — consecutive: ${winsTracker[shadow.id.toString()]}/${scoring.minEpochsConsecutive}`,
      );
    } else {
      winsTracker[shadow.id.toString()] = 0;
    }

    if (winsTracker[shadow.id.toString()] >= scoring.minEpochsConsecutive) {
      const blockReason = checkGuards(shadow, scoring);
      if (blockReason) {
        console.log(`[Promoter] Would promote #${shadow.id} but BLOCKED: ${blockReason}`);
        continue;
      }

      console.log(
        `[Promoter] Shadow #${shadow.id} cleared all guards over ${scoring.minEpochsConsecutive} epochs. Promoting.`,
      );
      const consecutive = winsTracker[shadow.id.toString()];
      await promoteStrategy(shadow.id, shadow.name, active.id, active.name, scoreDiff, consecutive);
      winsTracker[shadow.id.toString()] = 0;
      activeAgeEpochs = 0;
    }
  }
}

async function promoteStrategy(
  shadowId: bigint,
  shadowName: string,
  activeId: bigint,
  activeName: string,
  scoreDelta: number,
  consecutive: number,
) {
  try {
    const hash = await walletClient.writeContract({
      address: CONFIG.vaultAddress,
      abi: FLOAT_VAULT_ABI,
      functionName: 'promote',
      args: [shadowId],
      gasPrice: 100000000n,
    });
    console.log(`[Promoter] Promotion tx submitted: ${hash}`);

    // Capture the block at promotion time for the journal entry
    let blockNumber = 0n;
    try {
      blockNumber = await publicClient.getBlockNumber();
    } catch {
      /* non-fatal — journal entry still useful without it */
    }

    logPromotion({
      fromStrategyId: Number(activeId),
      fromStrategyName: activeName,
      toStrategyId: Number(shadowId),
      toStrategyName: shadowName,
      blockNumber,
      txHash: hash,
      scoreDelta,
      consecutiveEpochs: consecutive,
    });
  } catch (error) {
    console.error(`[Promoter] Error promoting #${shadowId}:`, error);
    revertTracker[shadowId.toString()] = (revertTracker[shadowId.toString()] || 0) + 1;
  }
}
