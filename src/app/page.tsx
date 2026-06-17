import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-6">
      <main className="max-w-2xl w-full text-center space-y-10">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-accent">Lepta</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-md mx-auto">
            Pay-per-second livestream payments. Provably delivered.
            Settled in USDC on Arc.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/creator"
            className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-accent text-black font-semibold hover:bg-accent-dim transition-colors"
          >
            Go Live
          </Link>
          <Link
            href="/viewer/demo"
            className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-card-border text-foreground font-medium hover:bg-card-bg transition-colors"
          >
            Watch a Stream
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
          <div className="rounded-xl border border-card-border bg-card-bg p-5 text-left">
            <div className="text-accent font-mono text-sm mb-2">01</div>
            <h3 className="font-semibold mb-1">Proof of Flow</h3>
            <p className="text-sm text-zinc-500">
              Dual-sided attestation verifies content was actually delivered,
              not just that a tab was open.
            </p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5 text-left">
            <div className="text-accent font-mono text-sm mb-2">02</div>
            <h3 className="font-semibold mb-1">Streaming Meter</h3>
            <p className="text-sm text-zinc-500">
              USDC flows per second while you watch. Auto-pauses if delivery
              stalls. Gateway-batched settlement.
            </p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5 text-left">
            <div className="text-accent font-mono text-sm mb-2">03</div>
            <h3 className="font-semibold mb-1">Budget Agent</h3>
            <p className="text-sm text-zinc-500">
              An AI agent manages your spend — auto-pause at cap, reasoning
              visible live, top-up via App Kit.
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-600 pt-4">
          Built for the Lepton Agents Hackathon. Powered by Circle, Arc &amp; USDC.
        </p>
      </main>
    </div>
  );
}
