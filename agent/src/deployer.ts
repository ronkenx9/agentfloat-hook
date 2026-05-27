/**
 * Deployer — autonomously deploys and registers approved parameter variant proposals.
 *
 * Walks all proposals, finds those with `status: approved` and `action_type: parameter_variant`,
 * compiles/deploys the strategy, registers it in FloatVault on-chain, and writes a spec file
 * to the second brain so the watcher can immediately begin scoring it.
 *
 * Runs every epoch or on demand.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { xLayerTestnetChain } from './scorer';
import { CONFIG } from './config';
import { FLOAT_VAULT_ABI } from './abi';

const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');
const PROPOSALS_DIR = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies', 'proposals');
const SPECS_DIR = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies');

interface ProposalRecord {
  filepath: string;
  frontmatter: Record<string, any>;
  body: string;
}

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

function loadApprovedProposals(): ProposalRecord[] {
  if (!fs.existsSync(PROPOSALS_DIR)) return [];
  const files = fs.readdirSync(PROPOSALS_DIR).filter((f) => f.endsWith('.md'));
  const records: ProposalRecord[] = [];
  for (const f of files) {
    const filepath = path.join(PROPOSALS_DIR, f);
    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      const parsed = matter(raw);
      if (parsed.data.status === 'approved' && parsed.data.action_type === 'parameter_variant') {
        records.push({ filepath, frontmatter: parsed.data, body: parsed.content });
      }
    } catch (err) {
      console.warn(`[deployer] Skipped parsing ${f}: ${(err as Error).message}`);
    }
  }
  return records;
}

function saveProposal(rec: ProposalRecord) {
  const out = matter.stringify(rec.body, rec.frontmatter);
  fs.writeFileSync(rec.filepath, out);
}

function extractBpsPerBlock(body: string, headline: string): bigint {
  let rawVal = 1000n; // default 10 bps (1000)
  const match = body.match(/rate\s*=\s*(\d+)\s*bps/i) || 
                headline.match(/rate\s*=\s*(\d+)\s*bps/i) ||
                body.match(/RATE_PER_BLOCK_BPS\s*=\s*(\d+)/i) ||
                body.match(/bpsPerBlock\s*=\s*(\d+)/i);
  if (match) {
    const parsedNum = BigInt(match[1]);
    if (parsedNum < 100n) {
      rawVal = parsedNum * 100n; // convert bps to contract scale (1 bps = 100)
    } else {
      rawVal = parsedNum;
    }
  }
  return rawVal;
}

export async function runDeployer(): Promise<number> {
  const approvedProposals = loadApprovedProposals();
  if (approvedProposals.length === 0) {
    console.log('[Deployer] No approved parameter_variant proposals to deploy.');
    return 0;
  }

  console.log(`[Deployer] Found ${approvedProposals.length} approved parameter variant(s) to process.`);
  let deployedCount = 0;

  for (const rec of approvedProposals) {
    const filename = path.basename(rec.filepath);
    console.log(`[Deployer] Processing approved proposal: ${filename}`);

    try {
      // 1. Extract params
      const bpsPerBlock = extractBpsPerBlock(rec.body, rec.frontmatter.headline || '');
      
      // 2. Fetch USDC Address from Vault
      const usdcAddress = await publicClient.readContract({
        address: CONFIG.vaultAddress,
        abi: parseAbi(['function usdc() view returns (address)']),
        functionName: 'usdc',
      }) as `0x${string}`;
      
      // 3. Load Compiled Artifact
      const artifactPath = path.join(__dirname, '../../contracts/out/MockYieldStrategy.sol/MockYieldStrategy.json');
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`MockYieldStrategy artifact not found at ${artifactPath}. Run forge build first.`);
      }
      
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      const abi = artifact.abi;
      const bytecode = artifact.bytecode.object as `0x${string}`;

      // 4. Deploy Contract
      console.log(`[Deployer] Deploying MockYieldStrategy. args: USDC=${usdcAddress}, Vault=${CONFIG.vaultAddress}, bpsPerBlock=${bpsPerBlock}...`);
      const deployHash = await walletClient.deployContract({
        abi,
        bytecode,
        args: [usdcAddress, CONFIG.vaultAddress, bpsPerBlock],
        gasPrice: 100000000n, // legacy gas price
      });
      console.log(`[Deployer] Submitted deploy tx: ${deployHash}`);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
      const newStrategyAddress = receipt.contractAddress;
      if (!newStrategyAddress) {
        throw new Error("Contract address was not returned in the deploy receipt.");
      }
      console.log(`[Deployer] Deployed at: ${newStrategyAddress}`);

      // 5. Register in FloatVault on-chain
      console.log(`[Deployer] Registering strategy in FloatVault as shadow strategy...`);
      const regHash = await walletClient.writeContract({
        address: CONFIG.vaultAddress,
        abi: FLOAT_VAULT_ABI,
        functionName: 'registerStrategy',
        args: [newStrategyAddress, true], // register as shadow
        gasPrice: 100000000n,
      });
      console.log(`[Deployer] Submitted register tx: ${regHash}`);
      await publicClient.waitForTransactionReceipt({ hash: regHash });

      // 6. Query strategy count to get ID
      const strategyId = await publicClient.readContract({
        address: CONFIG.vaultAddress,
        abi: FLOAT_VAULT_ABI,
        functionName: 'strategyCount',
      }) as bigint;
      console.log(`[Deployer] Registered successfully as strategy ID: ${strategyId}`);

      // 7. Write Strategy Spec to brain skills
      const specFilename = `mock-yield-strategy-v${strategyId}.md`;
      const specPath = path.join(SPECS_DIR, specFilename);
      const expectedApyBps = Number(bpsPerBlock) / 2; // approximation for expected apy bps based on rate
      const isMainnet = CONFIG.chainId === 196;
      const networkName = isMainnet ? 'x-layer-mainnet' : 'x-layer-testnet';
      const explorerUrl = xLayerTestnetChain.blockExplorers.default.url;

      const specContent = `---
name: agentfloat-strategy-mock-yield-v${strategyId}
strategy_id: ${strategyId}
contract_address: "${newStrategyAddress}"
network: ${networkName}
chain_id: ${CONFIG.chainId}
status: shadow
is_shadow: true
expected_apy_bps: ${expectedApyBps}
risk_profile: simulated
paused: false
description: Parameter variant deployed autonomously by agent from proposal ${filename}.
---

# Mock Yield Strategy v${strategyId}

Parameter variant deployed autonomously by the AgentFloat deploy loop.

## Parameters
- **bpsPerBlock**: ${bpsPerBlock} (contract scale)
- **Source Proposal**: [${filename}](./proposals/${filename})
- **Tx Hash**: [${deployHash}](${explorerUrl}/tx/${deployHash})
`;
      fs.writeFileSync(specPath, specContent);
      console.log(`[Deployer] Wrote strategy spec to ${specPath}`);

      // 8. Update Proposal File Frontmatter
      rec.frontmatter.status = 'executed';
      rec.frontmatter.executed_at = new Date().toISOString();
      rec.frontmatter.executed_tx = deployHash;
      rec.frontmatter.strategy_id = Number(strategyId);
      rec.frontmatter.deployed_address = newStrategyAddress;
      saveProposal(rec);
      console.log(`[Deployer] Proposal marked executed`);

      // 9. Append Log to Journal
      const today = new Date().toISOString().slice(0, 10);
      const journalPath = path.join(BRAIN_PATH, 'journal', `${today}.md`);
      const journalEntry = `
## AgentFloat strategy deployment

- **Proposal:** \`${filename}\`
- **Type:** parameter_variant
- **Strategy ID:** ${strategyId}
- **Strategy Name:** Mock Yield Strategy (v${strategyId})
- **Deployed Address:** [${newStrategyAddress}](${explorerUrl}/address/${newStrategyAddress})
- **Constructor Arg (bpsPerBlock):** ${bpsPerBlock}
- **Tx:** [${deployHash}](${explorerUrl}/tx/${deployHash})
- **Time:** ${new Date().toISOString()}
`;
      fs.appendFileSync(journalPath, journalEntry);
      console.log(`[Deployer] Appended log to journal: ${journalPath}`);
      deployedCount++;
    } catch (err) {
      console.error(`[Deployer] Failed to process proposal ${filename}:`, err);
    }
  }

  return deployedCount;
}

if (require.main === module) {
  runDeployer().catch((err) => {
    console.error('[Deployer] Fatal:', err);
    process.exit(1);
  });
}
