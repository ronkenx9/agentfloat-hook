"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";

export const X_LAYER_MAINNET = {
  id: 196,
  name: "X Layer Mainnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/xlayer" } },
} as const;

export const X_LAYER_TESTNET = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech/terigon"] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/xlayer-test" } },
} as const;

const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "196", 10);
export const ACTIVE_CHAIN = chainId === 196 ? X_LAYER_MAINNET : X_LAYER_TESTNET;

export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
  (chainId === 196 ? "0xbF06de108735332D1EDb81C7A77A750DD428a6f4" : "0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f")) as Address;

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  (chainId === 196 ? "0x779Ded0c9e1022225f8E0630b35a9b54bE713736" : "0x39684D42654752F246449e84524Fc972D57Ef985")) as Address;

// MockUSDC uses 18 decimals (it's a plain ERC20 mock). Real USDC is 6.
export const USDC_DECIMALS = 18;

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const VAULT_ABI = [
  {
    name: "park",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "deposits",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function publicClient() {
  return createPublicClient({
    chain: ACTIVE_CHAIN as any,
    transport: http(),
  });
}

export function walletClient() {
  if (typeof window === "undefined") throw new Error("walletClient requires browser");
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet");
  return createWalletClient({
    chain: ACTIVE_CHAIN as any,
    transport: custom(eth),
  });
}

export function toUsdc(human: string): bigint {
  return parseUnits(human, USDC_DECIMALS);
}

export function fromUsdc(raw: bigint): string {
  return formatUnits(raw, USDC_DECIMALS);
}

export async function readBalances(account: Address) {
  const c = publicClient();
  const [usdcRaw, depositRaw, allowanceRaw] = await Promise.all([
    c.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
    c.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "deposits", args: [account] }),
    c.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account, VAULT_ADDRESS],
    }),
  ]);

  return {
    usdcBalance: usdcRaw as bigint,
    vaultDeposit: depositRaw as bigint,
    vaultAllowance: allowanceRaw as bigint,
  };
}

export interface TxStep {
  label: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  hash?: `0x${string}`;
  error?: string;
}

/** Mint MockUSDC to the connected wallet — testnet faucet. */
export async function mintTestUsdc(account: Address, amountHuman: string): Promise<`0x${string}`> {
  const wc = walletClient();
  const hash = await wc.writeContract({
    account,
    chain: ACTIVE_CHAIN as any,
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "mint",
    args: [account, toUsdc(amountHuman)],
    gasPrice: 100_000_000n,
  });
  await publicClient().waitForTransactionReceipt({ hash });
  return hash;
}

export async function approveVault(account: Address, amountHuman: string): Promise<`0x${string}`> {
  const wc = walletClient();
  const hash = await wc.writeContract({
    account,
    chain: ACTIVE_CHAIN as any,
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [VAULT_ADDRESS, toUsdc(amountHuman)],
    gasPrice: 100_000_000n,
  });
  await publicClient().waitForTransactionReceipt({ hash });
  return hash;
}

export async function park(account: Address, amountHuman: string): Promise<`0x${string}`> {
  const wc = walletClient();
  const hash = await wc.writeContract({
    account,
    chain: ACTIVE_CHAIN as any,
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "park",
    args: [toUsdc(amountHuman)],
    gasPrice: 100_000_000n,
  });
  await publicClient().waitForTransactionReceipt({ hash });
  return hash;
}

export async function withdrawFromVault(account: Address, amountHuman: string): Promise<`0x${string}`> {
  const wc = walletClient();
  const hash = await wc.writeContract({
    account,
    chain: ACTIVE_CHAIN as any,
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "withdraw",
    args: [toUsdc(amountHuman)],
    gasPrice: 100_000_000n,
  });
  await publicClient().waitForTransactionReceipt({ hash });
  return hash;
}
