"use client";

import { useState, useCallback, useEffect } from "react";

interface WalletConnectProps {
  onConnect: (address: string) => void;
  onDeposit?: (amount: string) => void;
  connected?: boolean;
  address?: string;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function WalletConnect({
  onConnect,
  onDeposit,
  connected = false,
  address = "",
}: WalletConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("1.0");
  const [depositing, setDepositing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [gatewayBalance, setGatewayBalance] = useState<string | null>(null);

  useEffect(() => {
    setHasMetaMask(typeof window !== "undefined" && !!window.ethereum?.isMetaMask);
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to connect your wallet");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length > 0) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x4CF1A2",
                chainName: "Arc Testnet",
                nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
                rpcUrls: ["https://rpc.testnet.arc.network"],
                blockExplorerUrls: ["https://testnet.arcscan.app"],
              },
            ],
          });
        } catch {
          // Chain may already be added
        }

        onConnect(accounts[0]);
        fetchBalances();
      }
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [onConnect]);

  const fetchBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/balance");
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.wallet?.balance ?? null);
        setGatewayBalance(data.gateway?.available ?? null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (connected) fetchBalances();
  }, [connected, fetchBalances]);

  const handleDeposit = useCallback(async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setDepositing(true);
    try {
      onDeposit?.(depositAmount);
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: depositAmount }),
      });
      if (res.ok) {
        setShowDeposit(false);
        fetchBalances();
      }
    } catch (err) {
      console.error("Deposit failed:", err);
    } finally {
      setDepositing(false);
    }
  }, [depositAmount, onDeposit, fetchBalances]);

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--meter-flowing)]" />
          <span className="text-xs text-accent font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <span className="text-xs text-zinc-600">Arc Testnet</span>
        </div>

        {(walletBalance || gatewayBalance) && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-zinc-900 p-2">
              <span className="text-zinc-500 block">Wallet</span>
              <span className="font-mono text-foreground">
                {walletBalance ?? "—"} USDC
              </span>
            </div>
            <div className="rounded-lg bg-zinc-900 p-2">
              <span className="text-zinc-500 block">Gateway</span>
              <span className="font-mono text-accent">
                {gatewayBalance ?? "—"} USDC
              </span>
            </div>
          </div>
        )}

        {!showDeposit ? (
          <button
            onClick={() => setShowDeposit(true)}
            className="w-full text-xs border border-card-border rounded-lg px-3 py-2 hover:bg-card-bg transition-colors"
          >
            Deposit to Gateway
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              step="0.1"
              min="0.01"
              className="flex-1 bg-zinc-900 border border-card-border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
              placeholder="USDC amount"
            />
            <button
              onClick={handleDeposit}
              disabled={depositing}
              className="text-xs bg-accent text-black px-3 py-1.5 rounded-lg font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {depositing ? "..." : "Deposit"}
            </button>
            <button
              onClick={() => setShowDeposit(false)}
              className="text-xs text-zinc-500 px-2"
            >
              x
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="inline-flex items-center justify-center gap-2 text-xs bg-accent text-black px-4 py-2 rounded-full font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
    >
      {isConnecting ? (
        "Connecting..."
      ) : hasMetaMask ? (
        "Connect MetaMask"
      ) : (
        "Connect Wallet"
      )}
    </button>
  );
}
