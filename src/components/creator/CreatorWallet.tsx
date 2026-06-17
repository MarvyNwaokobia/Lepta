"use client";

import { useState, useEffect, useCallback } from "react";

interface CreatorWalletProps {
  sellerAddress: string;
}

const SUPPORTED_CHAINS = [
  { id: "arcTestnet", name: "Arc Testnet", explorer: "https://testnet.arcscan.app" },
  { id: "baseSepolia", name: "Base Sepolia", explorer: "https://sepolia.basescan.org" },
  { id: "sepolia", name: "Ethereum Sepolia", explorer: "https://sepolia.etherscan.io" },
  { id: "arbitrumSepolia", name: "Arbitrum Sepolia", explorer: "https://sepolia.arbiscan.io" },
];

export function CreatorWallet({ sellerAddress }: CreatorWalletProps) {
  const [walletBalance, setWalletBalance] = useState<string>("—");
  const [gatewayBalance, setGatewayBalance] = useState<string>("—");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawChain, setWithdrawChain] = useState("arcTestnet");
  const [withdrawing, setWithdrawing] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/balance");
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.wallet?.balance ?? "—");
        setGatewayBalance(data.gateway?.available ?? "—");
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  const handleWithdraw = useCallback(async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    setWithdrawing(true);
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: withdrawAmount,
          chain: withdrawChain,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastTx(data.mintTxHash ?? null);
        setShowWithdraw(false);
        setWithdrawAmount("");
        fetchBalances();
      }
    } catch (err) {
      console.error("Withdraw failed:", err);
    } finally {
      setWithdrawing(false);
    }
  }, [withdrawAmount, withdrawChain, fetchBalances]);

  const selectedChain = SUPPORTED_CHAINS.find((c) => c.id === withdrawChain);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Creator Wallet</h3>
        <span className="text-xs text-zinc-500 font-mono">
          {sellerAddress.slice(0, 6)}...{sellerAddress.slice(-4)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-900 p-3">
          <span className="text-xs text-zinc-500 block mb-1">Wallet</span>
          <span className="text-lg font-mono font-bold text-foreground">
            {walletBalance}
          </span>
          <span className="text-xs text-zinc-500 ml-1">USDC</span>
        </div>
        <div className="rounded-lg bg-zinc-900 p-3">
          <span className="text-xs text-zinc-500 block mb-1">Gateway</span>
          <span className="text-lg font-mono font-bold text-accent">
            {gatewayBalance}
          </span>
          <span className="text-xs text-zinc-500 ml-1">USDC</span>
        </div>
      </div>

      {!showWithdraw ? (
        <button
          onClick={() => setShowWithdraw(true)}
          className="w-full text-xs border border-card-border rounded-lg px-3 py-2.5 hover:bg-zinc-900 transition-colors font-medium"
        >
          Withdraw from Gateway
        </button>
      ) : (
        <div className="space-y-3 border-t border-card-border pt-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Amount (USDC)</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              step="0.1"
              min="0.01"
              placeholder="0.00"
              className="w-full bg-zinc-900 border border-card-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">
              Destination chain
            </label>
            <select
              value={withdrawChain}
              onChange={(e) => setWithdrawChain(e.target.value)}
              className="w-full bg-zinc-900 border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              {SUPPORTED_CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount}
              className="flex-1 text-xs bg-accent text-black px-3 py-2.5 rounded-lg font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {withdrawing ? "Withdrawing..." : "Withdraw"}
            </button>
            <button
              onClick={() => setShowWithdraw(false)}
              className="text-xs text-zinc-500 px-3 py-2.5 rounded-lg border border-card-border hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {lastTx && selectedChain && (
        <div className="text-xs text-zinc-500">
          Last withdrawal:{" "}
          <a
            href={`${selectedChain.explorer}/tx/${lastTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline font-mono"
          >
            {lastTx.slice(0, 12)}...
          </a>
        </div>
      )}
    </div>
  );
}
