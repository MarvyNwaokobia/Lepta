"use client";

const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";

export function NetworkBadge() {
  const isTestnet = NETWORK === "testnet";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border ${
        isTestnet
          ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
          : "border-green-500/30 text-green-400 bg-green-500/10"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isTestnet ? "bg-amber-400" : "bg-green-400"
        }`}
      />
      {isTestnet ? "testnet" : "mainnet"}
    </span>
  );
}
