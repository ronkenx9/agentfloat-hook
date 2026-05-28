import { createPublicClient, http } from 'viem';
import { xLayerTestnetChain } from './scorer';
import { CONFIG, loadOperationalConfig } from './config';
import { scoreStrategies } from './scorer';
import { checkPromotions, tickActiveAge } from './promoter';
import { consolidate } from './consolidator';
import { runOrchestrator } from './orchestrator';
import { runApprover } from './approver';
import { syncFromBrain } from './store';
import { runDeployer } from './deployer';

export async function startWatcher() {
  const isMainnet = CONFIG.chainId === 196;
  console.log(`[Watcher] Connecting to X Layer ${isMainnet ? 'mainnet' : 'testnet'} at ${CONFIG.rpcUrl}...`);

  const publicClient = createPublicClient({
    chain: xLayerTestnetChain,
    transport: http(),
  });

  let lastBlock = 0n;
  try {
    lastBlock = await publicClient.getBlockNumber();
    console.log(`[Watcher] Connected. Starting block: ${lastBlock}`);
  } catch (err) {
    console.error(`[Watcher] Failed to get initial block number:`, err);
  }

  let isScoring = false;
  let epochCount = 0;
  // Refresh the wiki immediately on startup so it reflects current state
  let lastConsolidatedEpoch = -1;
  let lastOrchestratedEpoch = 0;
  let orchestratorBusy = false;

  setInterval(async () => {
    if (isScoring) {
      console.log(`[Watcher] Previous scoring epoch still running, skipping.`);
      return;
    }

    try {
      const currentBlock = await publicClient.getBlockNumber();
      if (currentBlock > lastBlock) {
        console.log(`[Watcher] New block: ${currentBlock} (diff: ${currentBlock - lastBlock})`);
        lastBlock = currentBlock;

        isScoring = true;
        tickActiveAge();
        epochCount += 1;

        // Re-read operational config from brain — fresh on every epoch
        const opCfg = loadOperationalConfig();
        console.log(
          `[Watcher] Loaded ${opCfg.strategies.length} strategy specs from brain (` +
            opCfg.strategies.map((s) => `${s.name}${s.paused ? '⏸' : ''}`).join(', ') +
            ')',
        );

        // Score
        const results = await scoreStrategies();

        // Promote if criteria met
        if (results.length > 0) {
          await checkPromotions(results);
        }

        // Trust layer — every epoch, run the approver against pending proposals.
        // Cheap (just markdown I/O), keeps proposal state in sync with operating mode edits.
        try {
          await runApprover();
        } catch (err) {
          console.warn(`[Watcher] Approver failed (non-fatal): ${(err as Error).message}`);
        }

        // API layer — sync brain markdown into SQLite so the dashboard can read state.
        // Cheap and idempotent. Markdown stays source of truth; DB is the read replica.
        try {
          syncFromBrain();
        } catch (err) {
          console.warn(`[Watcher] DB sync failed (non-fatal): ${(err as Error).message}`);
        }

        // Deployer loop — check if any approved parameter variant proposals are ready to deploy.
        try {
          await runDeployer();
        } catch (err) {
          console.warn(`[Watcher] Deployer failed (non-fatal): ${(err as Error).message}`);
        }

        // Reflexive layer — every N epochs, consolidate raw logs into history wiki
        const cadence = opCfg.scoring.consolidateEveryEpochs;
        if (epochCount - lastConsolidatedEpoch >= cadence) {
          console.log(
            `[Watcher] Consolidating (epoch ${epochCount}, cadence=${cadence}) — refreshing ~/brain/wiki/agentfloat-history.md`,
          );
          try {
            await consolidate();
            lastConsolidatedEpoch = epochCount;
          } catch (err) {
            console.warn(`[Watcher] Consolidate failed (non-fatal): ${(err as Error).message}`);
          }
        }

        // Generative layer — every N epochs, the orchestrator proposes an action.
        // Runs detached so it doesn't block the scoring loop.
        const orchCadence = opCfg.scoring.orchestrateEveryEpochs;
        if (
          process.env.GROQ_API_KEY &&
          !orchestratorBusy &&
          epochCount - lastOrchestratedEpoch >= orchCadence
        ) {
          console.log(
            `[Watcher] Orchestrator firing (epoch ${epochCount}, cadence=${orchCadence}) — Groq llama-3.3 reading brain...`,
          );
          orchestratorBusy = true;
          lastOrchestratedEpoch = epochCount;
          runOrchestrator()
            .catch((err) => {
              console.warn(`[Watcher] Orchestrator failed (non-fatal): ${(err as Error).message}`);
            })
            .finally(() => {
              orchestratorBusy = false;
            });
        }
      }
    } catch (error) {
      console.error('[Watcher] Error in watcher loop:', error);
    } finally {
      isScoring = false;
    }
  }, CONFIG.pollIntervalMs);
}
