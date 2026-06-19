"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import { MeterWidget } from "@/components/player/MeterWidget";
import { AgentFeed } from "@/components/player/AgentFeed";
import { useLepta } from "@/hooks/useLepta";
import type { AgentDecision } from "@/lib/types";

const OWNCAST_HLS = process.env.NEXT_PUBLIC_OWNCAST_URL
  ? `${process.env.NEXT_PUBLIC_OWNCAST_URL}/hls/stream.m3u8`
  : "http://localhost:8080/hls/stream.m3u8";

const DEMO_AGENT_TICKS: Omit<AgentDecision, "session_id" | "tick_timestamp">[] = [
  { remaining_budget: 0.992, current_rate: 0.001, engagement_signal: 0.81, decision: "continue", reasoning_text: "Strong engagement, healthy budget. Continuing to pay." },
  { remaining_budget: 0.978, current_rate: 0.001, engagement_signal: 0.74, decision: "continue", reasoning_text: "Chat activity high, 978 seconds of budget left. No action needed." },
  { remaining_budget: 0.961, current_rate: 0.001, engagement_signal: 0.65, decision: "continue", reasoning_text: "Engagement dipped slightly but still above threshold. Continuing." },
  { remaining_budget: 0.943, current_rate: 0.001, engagement_signal: 0.42, decision: "continue", reasoning_text: "Engagement cooling. Budget still healthy at $0.94. Monitoring." },
  { remaining_budget: 0.924, current_rate: 0.001, engagement_signal: 0.18, decision: "pause", reasoning_text: "Engagement dropped to 0.18 — below value threshold. Pausing to preserve budget." },
  { remaining_budget: 0.924, current_rate: 0.001, engagement_signal: 0.52, decision: "continue", reasoning_text: "Engagement recovered to 0.52. Resuming payments." },
  { remaining_budget: 0.103, current_rate: 0.001, engagement_signal: 0.69, decision: "topup", reasoning_text: "Only 103 seconds remaining. Engagement high — requesting top-up to continue watching." },
];

export default function ViewerPage() {
  const params = useParams();
  const streamId = params.streamId as string;
  const isDemo = streamId === "demo";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<string>("paused");
  const [walletConnected, setWalletConnected] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);
  const [bufferHealth, setBufferHealth] = useState(0);
  const [streamTitle, setStreamTitle] = useState("");

  // Demo mode state
  const [demoAccrued, setDemoAccrued] = useState(0);
  const [demoStatus, setDemoStatus] = useState<"flowing" | "paused" | "stopped">("flowing");
  const [demoAgentDecisions, setDemoAgentDecisions] = useState<AgentDecision[]>([]);
  const [demoSegServer, setDemoSegServer] = useState(0);
  const [demoSegClient, setDemoSegClient] = useState(0);
  const [demoStalls, setDemoStalls] = useState(0);
  const agentTickIndex = useRef(0);

  const ratePerSecond = 0.001;
  const dailyCap = 1.0;

  const {
    connected: wsConnected,
    meter,
    agentDecisions: liveAgentDecisions,
    settlements,
    sendHeartbeat,
    sendReaction,
  } = useLepta({ streamId, sessionId, dailyCap, ratePerSecond });

  // Auto-start demo mode
  useEffect(() => {
    if (!isDemo) return;
    setWalletConnected(true);
    setStreamTitle("Lepta Demo — Pay-Per-Second Livestream");
    setPlayerState("playing");

    // Meter tick every second
    const meterInterval = setInterval(() => {
      setDemoAccrued((prev) => {
        if (demoStatus !== "flowing") return prev;
        const next = prev + ratePerSecond;
        if (next >= dailyCap) {
          setDemoStatus("stopped");
          return dailyCap;
        }
        return next;
      });
    }, 1000);

    // Segment tick every 2 seconds
    const segInterval = setInterval(() => {
      if (demoStatus !== "flowing") return;
      setDemoSegServer((p) => p + 1);
      setDemoSegClient((p) => p + 1);
      setSegmentCount((p) => p + 1);
      setBufferHealth(2.5 + Math.random() * 2);
    }, 2000);

    // Agent tick every 8 seconds
    const agentInterval = setInterval(() => {
      const idx = agentTickIndex.current % DEMO_AGENT_TICKS.length;
      const template = DEMO_AGENT_TICKS[idx];
      agentTickIndex.current++;

      const decision: AgentDecision = {
        session_id: "demo",
        tick_timestamp: Date.now(),
        ...template,
      };

      setDemoAgentDecisions((prev) => [decision, ...prev].slice(0, 15));

      if (decision.decision === "pause") {
        setDemoStatus("paused");
        setDemoStalls((p) => p + 1);
        // Auto-resume after 4 seconds
        setTimeout(() => setDemoStatus("flowing"), 4000);
      } else if (demoStatus === "paused" && decision.decision === "continue") {
        setDemoStatus("flowing");
      }
    }, 8000);

    return () => {
      clearInterval(meterInterval);
      clearInterval(segInterval);
      clearInterval(agentInterval);
    };
  }, [isDemo, demoStatus, ratePerSecond, dailyCap]);

  // Non-demo: fetch stream info
  useEffect(() => {
    if (isDemo) return;
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
  }, [streamId, isDemo]);

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

  // Choose demo vs live data
  const displayAccrued = isDemo ? demoAccrued : wsConnected ? meter.totalAccrued : demoAccrued;
  const displayStatus = isDemo
    ? demoStatus
    : !walletConnected
      ? ("paused" as const)
      : wsConnected
        ? meter.status
        : ("flowing" as const);
  const displayDecisions = isDemo ? demoAgentDecisions : liveAgentDecisions;
  const displaySegServer = isDemo ? demoSegServer : segmentCount;
  const displaySegClient = isDemo ? demoSegClient : segmentCount;
  const displayMatch = isDemo
    ? demoSegServer > 0
      ? demoStatus === "paused" ? "97%" : "100%"
      : "—"
    : segmentCount > 0
      ? meter.match ? "100%" : "partial"
      : "—";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-card-border px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-accent font-bold text-lg">
            Lepta
          </Link>
          <span className="text-zinc-500 text-sm hidden sm:inline">/ viewer</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {(isDemo || wsConnected) && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--meter-flowing)] animate-pulse-glow" />
              live
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            testnet
          </span>
          {!walletConnected && !isDemo ? (
            <button
              onClick={handleConnect}
              className="text-xs bg-accent text-black px-3 py-1.5 rounded-full font-medium hover:bg-accent-dim transition-colors"
            >
              Connect &amp; Pay
            </button>
          ) : (
            <span className="text-xs text-accent font-mono hidden sm:inline">
              0xf638...305b
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Video area */}
        <div className="lg:col-span-2 space-y-3">
          {isDemo ? (
            <DemoVideoPlaceholder status={displayStatus} segmentCount={displaySegServer} />
          ) : (
            <StreamPlayer
              hlsUrl={OWNCAST_HLS}
              sessionId={sessionId ?? ""}
              onSegmentRendered={handleSegmentRendered}
              onPlayerState={setPlayerState}
              onBufferHealth={setBufferHealth}
            />
          )}
          <div className="flex items-center justify-between text-sm">
            <div className="text-zinc-400">
              <span className="font-medium text-foreground">
                {streamTitle || `Stream ${streamId.slice(0, 8)}...`}
              </span>
            </div>
            <div className="flex gap-3 sm:gap-4 text-xs text-zinc-500 font-mono">
              <span>seg: {displaySegServer}</span>
              <span>buf: {bufferHealth.toFixed(1)}s</span>
              <span>
                <span
                  className={
                    displayStatus === "flowing"
                      ? "text-[var(--meter-flowing)]"
                      : displayStatus === "paused"
                        ? "text-[var(--meter-paused)]"
                        : "text-[var(--meter-stopped)]"
                  }
                >
                  {displayStatus}
                </span>
              </span>
            </div>
          </div>

          {!isDemo && (
            <div className="flex gap-2">
              <button
                onClick={sendReaction}
                className="text-xs border border-card-border rounded-full px-3 py-1 hover:bg-card-bg transition-colors"
              >
                +1
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <MeterWidget
            ratePerSecond={ratePerSecond}
            totalAccrued={displayAccrued}
            dailyCap={dailyCap}
            status={displayStatus}
          />
          <AgentFeed decisions={displayDecisions} />

          {/* Proof of Flow */}
          <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Proof of Flow
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500">Server segments</span>
                <div className="font-mono text-foreground">{displaySegServer}</div>
              </div>
              <div>
                <span className="text-zinc-500">Client acked</span>
                <div className="font-mono text-foreground">{displaySegClient}</div>
              </div>
              <div>
                <span className="text-zinc-500">Match rate</span>
                <div className="font-mono text-accent">{displayMatch}</div>
              </div>
              <div>
                <span className="text-zinc-500">Stalls</span>
                <div className="font-mono text-foreground">
                  {isDemo ? demoStalls : meter.reason ? "1" : "0"}
                </div>
              </div>
            </div>
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

          {isDemo && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 text-center">
              <p className="text-xs text-accent mb-2">This is a live simulation</p>
              <p className="text-xs text-zinc-500">
                The meter, agent, and proof-of-flow are running in real-time.
                In production, this connects to a real Owncast stream with
                actual USDC settlement on Arc.
              </p>
              <Link
                href="/creator"
                className="inline-block mt-3 text-xs bg-accent text-black px-4 py-1.5 rounded-full font-medium hover:bg-accent-dim transition-colors"
              >
                Try it as a Creator
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DemoVideoPlaceholder({
  status,
  segmentCount,
}: {
  status: "flowing" | "paused" | "stopped";
  segmentCount: number;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-card-border bg-zinc-950 aspect-video relative flex items-center justify-center">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(45deg, transparent 40%, var(--accent) 50%, transparent 60%)",
            backgroundSize: "200% 200%",
            animation: status === "flowing" ? "shimmer 3s ease-in-out infinite" : "none",
          }}
        />
        {/* Scanlines */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />
      </div>

      <div className="relative z-10 text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              status === "flowing"
                ? "bg-[var(--meter-flowing)] animate-pulse-glow"
                : status === "paused"
                  ? "bg-[var(--meter-paused)]"
                  : "bg-[var(--meter-stopped)]"
            }`}
          />
          <span className="text-sm font-medium text-zinc-300 uppercase tracking-wider">
            {status === "flowing" ? "Live" : status === "paused" ? "Paused" : "Ended"}
          </span>
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          segment {segmentCount} • proof-of-flow active
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
