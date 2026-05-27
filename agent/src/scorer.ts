import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CONFIG } from './config';
import { FLOAT_VAULT_ABI, STRATEGY_ABI } from './abi';
import * as fs from 'fs';
import * as path from 'path';

export interface StrategyResult {
  id: bigint;
  name: string;
  strategyAddress: `0x${string}`;
  isActive: boolean;
  isShadow: boolean;
  totalDeposited: bigint;
  currentValue: bigint;
  score: bigint;
}

// Custom X Layer testnet chain definition
export const xLayerTestnetChain = {
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'OKB',
    symbol: 'OKB',
  },
  rpcUrls: {
    default: { http: [CONFIG.rpcUrl] },
    public: { http: [CONFIG.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer-test' },
  },
};

const publicClient = createPublicClient({
  chain: xLayerTestnetChain,
  transport: http(),
});

const account = privateKeyToAccount(CONFIG.promoterPrivateKey as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: xLayerTestnetChain,
  transport: http(),
});

export async function scoreStrategies() {
  console.log(`[Scorer] Starting scoring epoch...`);
  try {
    const vaultAddress = CONFIG.vaultAddress;
    if (vaultAddress === '0x0000000000000000000000000000000000000000') {
      console.log('[Scorer] Vault address not configured, skipping.');
      return [];
    }

    const strategyCount = await publicClient.readContract({
      address: vaultAddress,
      abi: FLOAT_VAULT_ABI,
      functionName: 'strategyCount',
    });

    const activeStrategyId = await publicClient.readContract({
      address: vaultAddress,
      abi: FLOAT_VAULT_ABI,
      functionName: 'activeStrategyId',
    });

    const currentBlock = await publicClient.getBlockNumber();
    console.log(`[Scorer] Current block: ${currentBlock}, Strategy count: ${strategyCount}, Active ID: ${activeStrategyId}`);

    const results = [];

    for (let id = 1n; id <= strategyCount; id++) {
      const [strategyAddress, isActive, isShadow, totalDeposited, lastScore, lastScoreAt] = 
        await publicClient.readContract({
          address: vaultAddress,
          abi: FLOAT_VAULT_ABI,
          functionName: 'strategies',
          args: [id],
        });

      const name = await publicClient.readContract({
        address: strategyAddress,
        abi: STRATEGY_ABI,
        functionName: 'name',
      });

      const currentValue = await publicClient.readContract({
        address: strategyAddress,
        abi: STRATEGY_ABI,
        functionName: 'currentValue',
      });

      // Compute score = (currentValue * 10000) / totalDeposited
      // If totalDeposited is 0, score is 10000 (100%)
      let score = 10000n;
      if (totalDeposited > 0n) {
        score = (currentValue * 10000n) / totalDeposited;
      }

      console.log(`[Scorer] Strategy #${id} (${name}): currentValue=${currentValue}, totalDeposited=${totalDeposited}, score=${score}`);

      // Post score to contract
      try {
        const hash = await walletClient.writeContract({
          address: vaultAddress,
          abi: FLOAT_VAULT_ABI,
          functionName: 'postScore',
          args: [id, score],
          gasPrice: 100000000n, // 0.1 gwei legacy gas price
        });
        console.log(`[Scorer] Posted score for Strategy #${id}. Tx Hash: ${hash}`);
        
        // Wait for transaction to be mined to prevent nonce collision
        await publicClient.waitForTransactionReceipt({ hash });
      } catch (txError) {
        console.error(`[Scorer] Failed to post score for Strategy #${id}:`, txError);
      }

      // Log score to ~/brain/raw/agentfloat-strategy-scores.md
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestamp}] epoch=${currentBlock} strategy=${id} (${name}) score=${score} active=${isActive}\n`;

      const brainDir = '/Users/gadgetplug/brain/raw';
      const scoreFilePath = path.join(brainDir, 'agentfloat-strategy-scores.md');

      try {
        if (!fs.existsSync(brainDir)) {
          fs.mkdirSync(brainDir, { recursive: true });
        }
        fs.appendFileSync(scoreFilePath, logLine);
      } catch (fileError) {
        console.warn(`[Scorer] Warning: Could not write score to ${scoreFilePath}. Reason: ${(fileError as Error).message}`);
      }

      // Mirror into SQLite for API consumption (non-fatal if it fails)
      try {
        const { insertScore } = await import('./store');
        insertScore({
          ts: new Date().toISOString(),
          epoch: Number(currentBlock),
          strategyId: Number(id),
          strategyName: name as string,
          score: Number(score),
          isActive,
        });
      } catch (dbErr) {
        // ignore — markdown is the source of truth
      }

      results.push({
        id,
        name,
        strategyAddress,
        isActive,
        isShadow,
        totalDeposited,
        currentValue,
        score,
      });
    }

    return results;
  } catch (error) {
    console.error('[Scorer] Error scoring strategies:', error);
    return [];
  }
}
