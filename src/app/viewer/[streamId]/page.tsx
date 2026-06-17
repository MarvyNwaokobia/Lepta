"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import { MeterWidget } from "@/components/player/MeterWidget";
import { AgentFeed } from "@/components/player/AgentFeed";
import { useLepta } from "@/hooks/useLepta";

const OWNCAST_HLS = process.env.NEXT_PUBLIC_OWNCAST_URL
  ? `${process.env.NEXT_PUBLIC_OWNCAST_URL}/hls/stream.m3u8`
  : "http://localhost:8080/hls/stream.m3u8";

export default function ViewerPage() {
  const params = useParams();
  const streamId = params.streamId as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<string>("paused");
  const [walletConnected, setWalletConnected] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);
  const [bufferHealth, setBufferHealth] = useState(0);
  const [streamTitle, setStreamTitle] = useState("");

  const ratePerSecond = 0.001;
  const dailyCap = 1.0;

  const {
    connected: wsConnected,
    meter,
    agentDecisions,
    settlements,
    sendHeartbeat,
    sendReaction,
  } = useLepta({ streamId, sessionId, dailyCap, ratePerSecond });

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
          viewer_wallet:
            process.env.NEXT_PUBLIC_BUYER_ADDRESS ??
            "0xf638D33b77e08Ff006Cd1c431440d3A9361A305b",
          daily_cap_usdc: dailyCap,
          network: "testnet",
        }),
      });

      if (res.ok) {
        const session = await res.json();
        setSessionId(session.session_id);
        setWalletConnected(true);
      }
    } catch {
      console.error("Failed to create session");
    }
  }, [streamId, dailyCap]);

  const handleSegmentRendered = useCallback(
    (sn: number) => {
      setSegmentCount(sn);
      const video = document.querySelector("video");
      const bh =
        video && video.buffered.length > 0
          ? video.buffered.end(video.buffered.length - 1) - video.currentTime
          : 0;
      sendHeartbeat(sn, bh, playerState);
    },
    [sendHeartbeat, playerState]
  );

  // Fallback meter for when WS isn't connected
  const [fallbackAccrued, setFallbackAccrued] = useState(0);
  useEffect(() => {
    if (wsConnected || !walletConnected) return;
    const interval = setInterval(() => {
      setFallbackAccrued((prev) => {
        const next = prev + ratePerSecond;
        return next >= dailyCap ? dailyCap : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [wsConnected, walletConnected, ratePerSecond, dailyCap]);

  const displayAccrued = wsConnected ? meter.totalAccrued : fallbackAccrued;
  const displayStatus = !walletConnected
    ? ("paused" as const)
    : wsConnected
      ? meter.status
      : displayAccrued >= dailyCap
        ? ("stopped" as const)
        : ("flowing" as const);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-card-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-accent font-bold text-lg">
            Lepta
          </Link>
          <span className="text-zinc-500 text-sm">/ viewer</span>
        </div>
        <div className="flex items-center gap-3">
          {wsConnected && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--meter-flowing)] animate-pulse-glow" />
              live
            </span>
          )}
          <span className="text-xs text-zinc-500 font-mono">testnet</span>
          {!walletConnected ? (
            <button
              onClick={handleConnect}
              className="text-xs bg-accent text-black px-3 py-1.5 rounded-full font-medium hover:bg-accent-dim transition-colors"
            >
              Connect &amp; Start Paying
            </button>
          ) : (
            <span className="text-xs text-accent font-mono">0xf638...305b</span>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <StreamPlayer
            hlsUrl={OWNCAST_HLS}
            sessionId={sessionId ?? ""}
            onSegmentRendered={handleSegmentRendered}
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

          {/* Reactions */}
          <div className="flex gap-2">
            <button
              onClick={sendReaction}
              className="text-xs border border-card-border rounded-full px-3 py-1 hover:bg-card-bg transition-colors"
            >
              +1
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <MeterWidget
            ratePerSecond={ratePerSecond}
            totalAccrued={displayAccrued}
            dailyCap={dailyCap}
            status={displayStatus}
          />
          <AgentFeed decisions={agentDecisions} />

          {/* Proof of Flow */}
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
                  {segmentCount > 0 ? (meter.match ? "100%" : "partial") : "—"}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Stalls</span>
                <div className="font-mono text-foreground">
                  {meter.reason ? "1" : "0"}
                </div>
              </div>
            </div>
            {meter.reason && (
              <div className="text-xs text-[var(--meter-paused)] mt-1">
                {meter.reason}
              </div>
            )}
          </div>

          {/* Settlements */}
          {settlements.length > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
              <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Settlements
              </h4>
              <div className="space-y-1">
                {settlements.map((s) => (
                  <div key={s.batch_id} className="flex justify-between text-xs">
                    <span className="font-mono text-accent">
                      ${s.total_amount.toFixed(6)}
                    </span>
                    {s.gateway_tx_hash ? (
                      <a
                        href={`https://testnet.arcscan.app/tx/${s.gateway_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline font-mono"
                      >
                        {s.gateway_tx_hash.slice(0, 10)}...
                      </a>
                    ) : (
                      <span className="text-zinc-600">pending</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
