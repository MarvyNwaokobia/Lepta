"use client";

import { useState } from "react";

interface SessionSetupProps {
  streamRate: number;
  onAuthorize: (config: {
    dailyCap: number;
    acceptedRate: number;
  }) => void;
  onCancel?: () => void;
}

const PRESET_CAPS = [0.5, 1.0, 5.0, 10.0];

export function SessionSetup({
  streamRate,
  onAuthorize,
  onCancel,
}: SessionSetupProps) {
  const [dailyCap, setDailyCap] = useState(1.0);
  const [customCap, setCustomCap] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const effectiveCap = useCustom ? parseFloat(customCap) || 0 : dailyCap;
  const maxWatchSeconds = effectiveCap / streamRate;
  const maxWatchFormatted = formatDuration(maxWatchSeconds);
  const hourlyRate = streamRate * 3600;

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-sm mb-1">Authorize Spending</h3>
        <p className="text-xs text-zinc-500">
          Set your session cap. The meter runs at the creator&apos;s rate — you
          only pay while content is provably delivered.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Stream rate</span>
          <span className="font-mono text-foreground">
            ${streamRate.toFixed(6)}/s{" "}
            <span className="text-zinc-600">(${hourlyRate.toFixed(4)}/hr)</span>
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Session cap (USDC)</label>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_CAPS.map((cap) => (
            <button
              key={cap}
              onClick={() => {
                setDailyCap(cap);
                setUseCustom(false);
              }}
              className={`text-xs font-mono py-2 rounded-lg border transition-colors ${
                !useCustom && dailyCap === cap
                  ? "border-accent text-accent bg-accent/10"
                  : "border-card-border text-zinc-400 hover:border-zinc-600"
              }`}
            >
              ${cap}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={customCap}
            onChange={(e) => {
              setCustomCap(e.target.value);
              setUseCustom(true);
            }}
            placeholder="Custom amount"
            step="0.1"
            min="0.01"
            max="100"
            className="flex-1 bg-zinc-900 border border-card-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="rounded-lg bg-zinc-900 p-3 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Max watch time</span>
          <span className="font-mono text-foreground">{maxWatchFormatted}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Max spend</span>
          <span className="font-mono text-accent">
            ${effectiveCap.toFixed(2)} USDC
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Auto-pause</span>
          <span className="text-zinc-400">
            On stall, cap reached, or agent decision
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() =>
            onAuthorize({ dailyCap: effectiveCap, acceptedRate: streamRate })
          }
          disabled={effectiveCap <= 0}
          className="flex-1 h-10 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          Start Paying
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="h-10 px-4 rounded-lg border border-card-border text-sm text-zinc-400 hover:bg-card-bg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-[10px] text-zinc-600 text-center">
        Payments settle via Circle Gateway on Arc Testnet. You can pause anytime.
      </p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
