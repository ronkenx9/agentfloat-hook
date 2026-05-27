"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { createWalletClient, createPublicClient, custom, http, formatUnits, type Address } from "viem";
import { SiweMessage } from "siwe";
import { fetchNonce, API_URL } from "./api";

interface WalletState {
  address: Address | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Returns { message, signature } if user signs, null if they cancel. */
  signSiwe: (statement: string) => Promise<{ message: string; signature: string } | null>;
  /** USDC balance shown on the dashboard receipt. */
  usdcBalance: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const X_LAYER_TESTNET = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech/terigon"] } },
} as const;

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x39684D42654752F246449e84524Fc972D57Ef985") as Address;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    connecting: false,
    error: null,
  });
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  useEffect(() => {
    // Try to recover an existing connection
    if (typeof window === "undefined") return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    eth.request({ method: "eth_accounts" }).then((accs: string[]) => {
      if (accs && accs[0]) {
        setState((s) => ({ ...s, address: accs[0] as Address }));
        eth.request({ method: "eth_chainId" }).then((cid: string) => {
          setState((s) => ({ ...s, chainId: parseInt(cid, 16) }));
        });
      }
    });

    const onAccountsChanged = (accs: string[]) =>
      setState((s) => ({ ...s, address: (accs[0] as Address) || null }));
    const onChainChanged = (cid: string) =>
      setState((s) => ({ ...s, chainId: parseInt(cid, 16) }));

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);

    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  // Refresh USDC balance when address changes
  useEffect(() => {
    if (!state.address) {
      setUsdcBalance(null);
      return;
    }

    const client = createPublicClient({
      chain: X_LAYER_TESTNET as any,
      transport: http(),
    });

    client
      .readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [state.address],
      })
      .then((raw) => {
        // MockUSDC in our deployment uses 18 decimals (it's just an ERC20 mock).
        // Real USDC is 6. Adjust here if you switch.
        const formatted = formatUnits(raw as bigint, 18);
        setUsdcBalance(parseFloat(formatted).toFixed(2));
      })
      .catch(() => setUsdcBalance(null));
  }, [state.address, state.chainId]);

  const connect = useCallback(async () => {
    if (typeof window === "undefined") return;
    const eth = (window as any).ethereum;
    if (!eth) {
      setState((s) => ({ ...s, error: "No wallet detected. Install MetaMask or OKX Wallet." }));
      return;
    }

    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const accs: string[] = await eth.request({ method: "eth_requestAccounts" });
      const cid: string = await eth.request({ method: "eth_chainId" });
      setState((s) => ({
        ...s,
        address: (accs[0] as Address) || null,
        chainId: parseInt(cid, 16),
        connecting: false,
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, connecting: false, error: err?.message ?? "Failed to connect" }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ address: null, chainId: null, connecting: false, error: null });
  }, []);

  const signSiwe = useCallback<WalletContextValue["signSiwe"]>(async (statement) => {
    if (typeof window === "undefined") return null;
    const eth = (window as any).ethereum;
    if (!eth || !state.address) return null;

    const nonce = await fetchNonce();
    if (!nonce) {
      setState((s) => ({ ...s, error: "Could not fetch auth nonce from agent API" }));
      return null;
    }

    const siwe = new SiweMessage({
      domain: window.location.host,
      address: state.address,
      statement,
      uri: window.location.origin,
      version: "1",
      chainId: state.chainId ?? 1952,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const message = siwe.prepareMessage();

    const walletClient = createWalletClient({
      chain: X_LAYER_TESTNET as any,
      transport: custom(eth),
    });

    try {
      const signature = await walletClient.signMessage({
        account: state.address,
        message,
      });
      return { message, signature };
    } catch (err: any) {
      setState((s) => ({ ...s, error: err?.message ?? "User cancelled signature" }));
      return null;
    }
  }, [state.address, state.chainId]);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, signSiwe, usdcBalance }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export { API_URL };
