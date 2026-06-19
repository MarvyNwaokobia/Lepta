import Link from "next/link";

const FIRST_TX_HASH = "0x76d2c3ade5d1e2d8453c890491b5891e4d530a506764883276b8bd87bb1f69b8";
const EXPLORER_URL = `https://testnet.arcscan.app/tx/${FIRST_TX_HASH}`;

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <header className="border-b border-card-border px-6 py-3 flex items-center justify-between">
        <span className="text-accent font-bold text-lg">Lepta</span>
        <div className="flex items-center gap-4">
          <Link href="/viewer/demo" className="text-sm text-zinc-400 hover:text-foreground transition-colors">
            Live Demo
          </Link>
          <Link
            href="/creator"
            className="text-sm bg-accent text-black px-4 py-1.5 rounded-full font-medium hover:bg-accent-dim transition-colors"
          >
            Go Live
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-3xl w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              Viewers pay per second.
              <br />
              <span className="text-accent">Creators earn per second.</span>
            </h1>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto leading-relaxed">
              If the stream stops, so does the money. No subscriptions.
              No donations. Just a meter that runs while content is
              actually being delivered.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/viewer/demo"
              className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-accent text-black font-semibold hover:bg-accent-dim transition-colors text-base"
            >
              See It Live
            </Link>
            <Link
              href="/creator"
              className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-card-border text-foreground font-medium hover:bg-card-bg transition-colors text-base"
            >
              Start Streaming
            </Link>
          </div>

          {/* How it works — visual flow */}
          <div className="pt-12 pb-4">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-6">How it works</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-0">
              <Step number="1" title="Stream" desc="Creator goes live via OBS" />
              <Arrow />
              <Step number="2" title="Verify" desc="Each segment is hashed and attested" />
              <Arrow />
              <Step number="3" title="Meter" desc="USDC flows per second of verified delivery" />
              <Arrow />
              <Step number="4" title="Settle" desc="Batched on-chain every 15s via Gateway" />
            </div>
          </div>

          {/* Why it's different */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <Card
              title="You don't pay for dead air"
              desc="If the stream stalls, buffers, or goes offline — the meter pauses automatically. Money only flows when bytes are provably delivered."
            />
            <Card
              title="An AI agent watches your wallet"
              desc="A budget agent evaluates engagement and your remaining balance every 10 seconds. It decides to keep paying, pause, or top up — and shows you why."
            />
            <Card
              title="Real USDC, real settlement"
              desc="Not play money. Payments settle in USDC on Arc via Circle Gateway. Sub-second finality. Transactions you can verify on-chain."
            />
          </div>

          {/* Proof — real tx */}
          <div className="pt-8 pb-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-card-border bg-card-bg px-5 py-2.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
              <span className="text-sm text-zinc-400">
                First settlement on Arc Testnet
              </span>
              <a
                href={EXPLORER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline font-mono"
              >
                {FIRST_TX_HASH.slice(0, 14)}...
              </a>
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-zinc-600 pb-8">
            Built for the Lepton Agents Hackathon. Powered by Circle Gateway, Arc &amp; USDC.
          </p>
        </div>
      </main>
    </div>
  );
}

function Step({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center text-center w-36">
      <div className="w-10 h-10 rounded-full border-2 border-accent text-accent flex items-center justify-center font-mono font-bold text-sm mb-2">
        {number}
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-zinc-500 mt-1">{desc}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden sm:flex items-center px-2 text-zinc-600">
      <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
        <path d="M0 6h20m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-5 text-left">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
    </div>
  );
}
