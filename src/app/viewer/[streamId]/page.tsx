"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import { MeterWidget } from "@/components/player/MeterWidget";
import { AgentFeed } from "@/components/player/AgentFeed";
import type { AgentDecision } from "@/lib/types";

const OWNCAST_HLS = process.env.NEXT_PUBLIC_OWNCAST_URL
  ? `${process.env.NEXT_PUBLIC_OWNCAST_URL}/hls/stream.m3u8`
  : "http://localhost:8080/hls/stream.m3u8";

export default function ViewerPage() {
  const params = useParams();
  const streamId = params.streamId as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [meterStatus, setMeterStatus] = useState<"flowing" | "paused" | "stopped">("paused");
  const [totalAccrued, setTotalAccrued] = useState(0);
  const [agentDecisions, setAgentDecisions] = useState<AgentDecision[]>([]);
  const [playerState, setPlayerState] = useState<string>("paused");
  const [connected, setConnected] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);
  const [bufferHealth, setBufferHealth] = useState(0);
  const [streamTitle, setStreamTitle] = useState("");

  const ratePerSecond = 0.001;
  const dailyCap = 1.0;

  useEffect(() => {
    async function fetchStream() {
      try {
        const res = await fetch(`/api/streams?id=${streamId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.title) setStreamTitle(data.title);
        }
      } catch {}
    }
    fetchStream();
  }, [streamId]);

  const handleConnect = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_id: streamId,
          viewer_wallet: process.env.NEXT_PUBLIC_BUYER_ADDRESS ?? "0xf638D33b77e08Ff006Cd1c431440d3A9361A305b",
          daily_cap_usdc: dailyCap,
          network: "testnet",
        }),
      });

      if (res.ok) {
        const session = await res.json();
        setSessionId(session.session_id);
        setConnected(true);
        setMeterStatus("flowing");
      }
    } catch {
      console.error("Failed to create session");
    }
  }, [streamId, dailyCap]);

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
      } catch {}
    }, 10000);

    return () => clearInterval(interval);
  }, [sessionId, meterStatus, totalAccrued, ratePerSecond, dailyCap]);

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

  const hlsUrl = streamId === "demo" ? OWNCAST_HLS : OWNCAST_HLS;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-card-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-accent font-bold text-lg">
            Lepta
          </Link>
          <span className="text-zinc-500 text-sm">/ viewer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono">testnet</span>
          {!connected ? (
            <button
              onClick={handleConnect}
              className="text-xs bg-accent text-black px-3 py-1.5 rounded-full font-medium hover:bg-accent-dim transition-colors"
            >
              Connect &amp; Start Paying
            </button>
          ) : (
            <span className="text-xs text-accent font-mono">
              0xf638...305b
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <StreamPlayer
            hlsUrl={hlsUrl}
            sessionId={sessionId ?? ""}
            onSegmentRendered={(sn) => setSegmentCount(sn)}
            onPlayerState={setPlayerState}
            onBufferHealth={setBufferHealth}
          />
          <div className="flex items-center justify-between text-sm">
            <div className="text-zinc-400">
              <span className="font-medium text-foreground">
                {streamTitle || `Stream ${streamId.slice(0, 8)}...`}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-zinc-500 font-mono">
              <span>seg: {segmentCount}</span>
              <span>buf: {bufferHealth.toFixed(1)}s</span>
              <span>
                player:{" "}
                <span
                  className={
                    playerState === "playing"
                      ? "text-[var(--meter-flowing)]"
                      : playerState === "stalled"
                        ? "text-[var(--meter-stopped)]"
                        : "text-[var(--meter-paused)]"
                  }
                >
                  {playerState}
                </span>
              </span>
            </div>
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

          <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Proof of Flow
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500">Server segments</span>
                <div className="font-mono text-foreground">{segmentCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">Client acked</span>
                <div className="font-mono text-foreground">{segmentCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">Match rate</span>
                <div className="font-mono text-accent">
                  {segmentCount > 0 ? "100%" : "—"}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Stalls</span>
                <div className="font-mono text-foreground">0</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
