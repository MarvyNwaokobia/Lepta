"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import { MeterWidget } from "@/components/player/MeterWidget";
import { AgentFeed } from "@/components/player/AgentFeed";
import type { AgentDecision } from "@/lib/types";

export default function ViewerPage() {
  const params = useParams();
  const streamId = params.streamId as string;

  const [sessionId] = useState<string | null>(null);
  const [meterStatus, setMeterStatus] = useState<"flowing" | "paused" | "stopped">("paused");
  const [totalAccrued, setTotalAccrued] = useState(0);
  const [agentDecisions, setAgentDecisions] = useState<AgentDecision[]>([]);
  const [, setPlayerState] = useState<string>("paused");
  const [connected, setConnected] = useState(false);

  const ratePerSecond = 0.001; // $0.001/s = $3.60/hr
  const dailyCap = 1.0;

  const handleConnect = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_id: streamId,
          viewer_wallet: "0xdemo_viewer_wallet",
          daily_cap_usdc: dailyCap,
          network: "testnet",
        }),
      });

      if (res.ok) {
        setConnected(true);
        setMeterStatus("flowing");
      }
    } catch {
      console.error("Failed to create session");
    }
  }, [streamId, dailyCap]);

  // Agent tick polling
  useEffect(() => {
    if (!sessionId || meterStatus !== "flowing") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            remaining_budget: dailyCap - totalAccrued,
            current_rate: ratePerSecond,
            daily_cap: dailyCap,
            engagement_signal: 0.5,
            elapsed_watch_seconds: totalAccrued / ratePerSecond,
            total_spent: totalAccrued,
          }),
        });
        if (res.ok) {
          const decision = await res.json();
          setAgentDecisions((prev) => [decision, ...prev].slice(0, 20));
          if (decision.decision === "pause") {
            setMeterStatus("paused");
          }
        }
      } catch {
        // Agent tick failure is non-fatal
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [sessionId, meterStatus, totalAccrued, ratePerSecond, dailyCap]);

  // Meter tick
  useEffect(() => {
    if (meterStatus !== "flowing") return;

    const interval = setInterval(() => {
      setTotalAccrued((prev) => {
        const next = prev + ratePerSecond;
        if (next >= dailyCap) {
          setMeterStatus("stopped");
          return dailyCap;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [meterStatus, ratePerSecond, dailyCap]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-card-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-accent font-bold text-lg">Lepta</span>
          <span className="text-zinc-500 text-sm">/ viewer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono">testnet</span>
          {!connected ? (
            <button
              onClick={handleConnect}
              className="text-xs bg-accent text-black px-3 py-1.5 rounded-full font-medium hover:bg-accent-dim transition-colors"
            >
              Connect Wallet
            </button>
          ) : (
            <span className="text-xs text-accent">0xdemo...wallet</span>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <StreamPlayer
            hlsUrl={`/api/streams/hls/${streamId}/playlist.m3u8`}
            sessionId={sessionId ?? ""}
            onSegmentRendered={() => {}}
            onPlayerState={setPlayerState}
          />
          <div className="text-sm text-zinc-400">
            <span className="font-medium text-foreground">Stream: </span>
            {streamId}
          </div>
        </div>

        <div className="space-y-4">
          <MeterWidget
            ratePerSecond={ratePerSecond}
            totalAccrued={totalAccrued}
            dailyCap={dailyCap}
            status={meterStatus}
          />
          <AgentFeed decisions={agentDecisions} />
        </div>
      </main>
    </div>
  );
}
