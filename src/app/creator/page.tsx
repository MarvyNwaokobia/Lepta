"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Session {
  session_id: string;
  viewer_wallet: string;
  rate_per_second: number;
  total_accrued: number;
  status: string;
  started_at: number;
}

interface StreamData {
  stream_id: string;
  title: string;
  rate_per_second: number;
  status: string;
  started_at: number;
}

export default function CreatorDashboard() {
  const [stream, setStream] = useState<StreamData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [title, setTitle] = useState("");
  const [rate, setRate] = useState("0.001");

  const createStream = useCallback(async () => {
    const res = await fetch("/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator_id: "creator_demo",
        title: title || "My Lepta Stream",
        rate_per_second: rate,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setStream(data);
    }
  }, [title, rate]);

  // Poll sessions
  useEffect(() => {
    if (!stream) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions?stream_id=${stream.stream_id}`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
          const total = data.reduce(
            (sum: number, s: Session) => sum + s.total_accrued,
            0
          );
          setTotalEarnings(total);
        }
      } catch {
        // Poll failure is non-fatal
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [stream]);

  if (!stream) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-card-border px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-accent font-bold text-lg">
            Lepta
          </Link>
          <span className="text-zinc-500 text-sm">/ go live</span>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Start a Stream</h2>
              <p className="text-sm text-zinc-500">
                Set your per-second rate and go live. Viewers pay only while
                content is provably delivered.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Stream Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Building Lepta live..."
                  className="w-full bg-card-bg border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Rate (USDC/second)
                </label>
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  step="0.0001"
                  min="0.000001"
                  className="w-full bg-card-bg border border-card-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  ${(parseFloat(rate) * 3600).toFixed(4)}/hr per viewer
                </p>
              </div>

              <button
                onClick={createStream}
                className="w-full h-12 rounded-full bg-accent text-black font-semibold hover:bg-accent-dim transition-colors"
              >
                Go Live
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const activeSessions = sessions.filter((s) => s.status === "active");
  const liveRate = activeSessions.reduce(
    (sum, s) => sum + s.rate_per_second,
    0
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-card-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-accent font-bold text-lg">
            Lepta
          </Link>
          <span className="text-zinc-500 text-sm">/ dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--meter-flowing)] animate-pulse-glow" />
            <span className="text-xs text-zinc-400">LIVE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <div className="text-xs text-zinc-500 mb-1">Total Earnings</div>
            <div className="text-2xl font-mono font-bold text-accent">
              ${totalEarnings.toFixed(6)}
            </div>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <div className="text-xs text-zinc-500 mb-1">Live Rate</div>
            <div className="text-2xl font-mono font-bold">
              ${liveRate.toFixed(6)}/s
            </div>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <div className="text-xs text-zinc-500 mb-1">Active Viewers</div>
            <div className="text-2xl font-mono font-bold">
              {activeSessions.length}
            </div>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <div className="text-xs text-zinc-500 mb-1">Total Sessions</div>
            <div className="text-2xl font-mono font-bold">
              {sessions.length}
            </div>
          </div>
        </div>

        {/* Stream info */}
        <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
          <h3 className="font-semibold">{stream.title}</h3>
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500 font-mono">
            <span>ID: {stream.stream_id.slice(0, 8)}...</span>
            <span>Rate: ${stream.rate_per_second}/s</span>
            <span>
              Started: {new Date(stream.started_at).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Active sessions */}
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
          <div className="px-4 py-3 border-b border-card-border">
            <h3 className="text-sm font-medium">Active Sessions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-card-border">
                  <th className="text-left px-4 py-2">Viewer</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Rate</th>
                  <th className="text-right px-4 py-2">Accrued</th>
                  <th className="text-right px-4 py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                      No viewers yet. Share your stream link to get started.
                    </td>
                  </tr>
                )}
                {sessions.map((s) => (
                  <tr key={s.session_id} className="border-b border-card-border/50">
                    <td className="px-4 py-2 font-mono text-xs">
                      {s.viewer_wallet.slice(0, 6)}...
                      {s.viewer_wallet.slice(-4)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 text-xs ${
                          s.status === "active"
                            ? "text-[var(--meter-flowing)]"
                            : s.status === "paused"
                              ? "text-[var(--meter-paused)]"
                              : "text-zinc-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.status === "active"
                              ? "bg-[var(--meter-flowing)]"
                              : s.status === "paused"
                                ? "bg-[var(--meter-paused)]"
                                : "bg-zinc-500"
                          }`}
                        />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      ${s.rate_per_second.toFixed(6)}/s
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-accent">
                      ${s.total_accrued.toFixed(6)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-zinc-500">
                      {Math.round((Date.now() - s.started_at) / 1000)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
