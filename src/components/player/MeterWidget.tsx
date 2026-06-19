"use client";

import { useEffect, useState, useRef } from "react";
import { playTick, playPause, playResume } from "@/lib/sounds";

interface MeterWidgetProps {
  ratePerSecond: number;
  totalAccrued: number;
  dailyCap: number;
  status: "flowing" | "paused" | "stopped";
}

export function MeterWidget({
  ratePerSecond,
  totalAccrued,
  dailyCap,
  status,
}: MeterWidgetProps) {
  const [displayTotal, setDisplayTotal] = useState(totalAccrued);
  const prevStatus = useRef(status);
  const tickCount = useRef(0);

  useEffect(() => {
    if (status !== "flowing") return;

    const interval = setInterval(() => {
      setDisplayTotal((prev) => {
        const next = prev + ratePerSecond;
        return next >= dailyCap ? dailyCap : next;
      });
      // Tick sound every 3rd second to avoid being annoying
      tickCount.current++;
      if (tickCount.current % 3 === 0) {
        playTick();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, ratePerSecond, dailyCap]);

  useEffect(() => {
    setDisplayTotal(totalAccrued);
  }, [totalAccrued]);

  // Sound on status change
  useEffect(() => {
    if (prevStatus.current === status) return;
    if (status === "paused" || status === "stopped") {
      playPause();
    } else if (status === "flowing" && prevStatus.current === "paused") {
      playResume();
    }
    prevStatus.current = status;
  }, [status]);

  const capPercent = Math.min(100, (displayTotal / dailyCap) * 100);

  const statusColor =
    status === "flowing"
      ? "text-[var(--meter-flowing)]"
      : status === "paused"
        ? "text-[var(--meter-paused)]"
        : "text-[var(--meter-stopped)]";

  const barColor =
    status === "flowing"
      ? "bg-[var(--meter-flowing)]"
      : status === "paused"
        ? "bg-[var(--meter-paused)]"
        : "bg-[var(--meter-stopped)]";

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${barColor} ${status === "flowing" ? "animate-pulse-glow" : ""}`}
          />
          <span className={`text-sm font-medium uppercase tracking-wider ${statusColor}`}>
            {status}
          </span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          ${ratePerSecond.toFixed(6)}/s
        </span>
      </div>

      <div className="text-3xl font-mono font-bold tracking-tight">
        <span className="text-accent">$</span>
        {displayTotal.toFixed(6)}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Session spend</span>
          <span>${dailyCap.toFixed(2)} cap</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
            style={{ width: `${capPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
