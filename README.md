# Lepta

**Pay-per-second livestream payments. Provably delivered. Settled in USDC on Arc.**

Viewers pay per second of actual content delivery. If the stream stalls, the meter pauses. An AI budget agent manages spend with visible reasoning. Settlements batch through Circle Gateway on Arc testnet.

**Live:** [lepta-eight.vercel.app](https://lepta-eight.vercel.app)
**Demo:** [lepta-eight.vercel.app/viewer/demo](https://lepta-eight.vercel.app/viewer/demo)

---

## The Problem

Every payment tool in the crypto creator ecosystem does per-call or per-article transactions. Live content is continuous, but payments aren't. Existing streaming payment protocols (Superfluid, Lightning) let money flow regardless of whether content is actually being delivered. You can drain a wallet while showing a "be right back" screen.

## The Solution

Lepta introduces **proof-of-flow** — a dual-sided attestation system that verifies content was actually delivered before money moves.

1. **Server attests:** Each HLS segment is hashed and timestamped as it leaves the streaming server
2. **Client attests:** The viewer's player confirms each segment was received and rendered
3. **Reconciliation:** Every second, server and client attestations are compared. Match = accrue. Mismatch = pause.
4. **Settlement:** Accrued amounts batch through Circle Gateway every 15 seconds as real USDC on Arc

## How It Works

```
Creator (OBS) → Owncast → HLS Segments → Segment Attestor (SHA-256 hash + timestamp)
                                                    ↓
Viewer (HLS.js) → Heartbeats ──────────→ Reconciliation Engine (1s loop)
                                                    ↓
                                          match? → accrue USDC
                                          no?    → pause meter
                                                    ↓ (every 10s)
                                          Budget Agent → Claude Haiku → continue / pause / topup
                                                    ↓ (every 15s)
                                          Gateway batch → on-chain settlement → Arc testnet
```

## Key Features

**Proof-of-Flow Oracle** — Not just a timer. Cryptographic verification that bytes were delivered before payment accrues.

**AI Budget Agent** — Claude Haiku evaluates remaining budget, engagement signal, and watch time every 10 seconds. Decides to continue, pause, or request top-up. Reasoning is visible live in the viewer UI.

**Gateway-Batched Settlement** — Payments accrue per second off-chain, settle on-chain in batches via Circle Gateway. No gas per viewer per second.

**Engagement Signal** — Composite score from chat activity and reactions, fed to the agent as input for spending decisions.

**Creator Dashboard** — Live earnings ticker, attestation match rate, stall detection, viewer session table, settlement history with Arc explorer links, Gateway balance with cross-chain withdrawal.

## Circle Tool Usage

| Tool | How Lepta Uses It |
|---|---|
| **Gateway (Nanopayments)** | Batched settlement of accrued per-second amounts |
| **x402 Protocol** | Paywall middleware for stream access (402 Payment Required flow) |
| **GatewayClient** | Buyer-side deposits, balance queries, cross-chain withdrawals |
| **EIP-3009** | TransferWithAuthorization signing for payment authorizations |
| **App Kit** | Wallet connection, unified balance display |
| **Arc Testnet** | Settlement chain — sub-second finality, native USDC gas |

## Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS
- **Real-time:** Socket.io (WebSocket for meter ticks, heartbeats, agent decisions)
- **Database:** SQLite (WAL mode) for sessions, attestations, meter ticks, settlements
- **Streaming:** Owncast (self-hosted, HLS output)
- **Player:** HLS.js with segment-level event reporting
- **AI Agent:** Claude Haiku via LangChain (with rule-based fallback)
- **Payments:** @circle-fin/x402-batching, @x402/core, @x402/evm, viem
- **Chain:** Arc Testnet (Chain ID: 5042002)

## Project Structure

```
src/
  app/
    page.tsx                          # Landing page
    creator/page.tsx                  # Creator dashboard
    viewer/[streamId]/page.tsx        # Viewer with auto-demo mode
    api/
      streams/       # Stream CRUD
      sessions/      # Viewer session management + safety rails
      heartbeat/     # Client-side attestation receiver
      attestations/  # Server-side attestation queries
      settlement/    # Gateway batch settlement + history
      agent/         # AI budget agent tick
      pay/           # x402 paywall (402 flow)
      balance/       # Wallet + Gateway balance
      deposit/       # Gateway USDC deposit
      withdraw/      # Gateway cross-chain withdrawal
      demo/          # Demo mode (simulated segments + sessions)
      owncast/       # Owncast status
      webhooks/owncast/  # Owncast event webhooks
  lib/
    types.ts         # Data model
    db.ts            # SQLite schema
    attestor.ts      # Segment hashing + attestation
    meter.ts         # Reconciliation engine
    agent.ts         # AI budget agent (Claude + fallback)
    settlement.ts    # Gateway batch settlement
    engagement.ts    # Chat + reaction composite signal
    safety.ts        # Rate limits, cap sanitization
    sounds.ts        # Web Audio meter sounds
    circle/
      gateway.ts            # GatewayClient, BatchFacilitatorClient
      x402-middleware.ts     # Next.js adapter for x402 paywall
      streaming-payment.ts   # Per-session settlement
    owncast/
      config.ts         # Owncast connection config
      segment-watcher.ts # HLS segment directory watcher
      webhooks.ts        # Stream/user event handlers
    realtime/
      engine.ts    # Socket.io server, reconciliation loop, settlement loop
  hooks/
    useLepta.ts    # Client-side WebSocket hook
  components/
    player/
      StreamPlayer.tsx   # HLS.js player with heartbeat
      MeterWidget.tsx    # Live meter with sound
      AgentFeed.tsx      # Agent reasoning feed
      SessionSetup.tsx   # Cap + rate authorization
    creator/
      CreatorWallet.tsx  # Gateway balance + withdrawal
    shared/
      WalletConnect.tsx  # MetaMask connection + deposit
      NetworkBadge.tsx   # Testnet/mainnet indicator
server.ts              # Custom server (Next.js + Socket.io)
scripts/
  setup-owncast-cloud.sh  # One-command VPS Owncast setup
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- Circle CLI: `npm install -g @circle-fin/cli`
- ARC CLI: `uv tool install git+https://github.com/the-canteen-dev/ARC-cli`

### Setup

```bash
git clone https://github.com/MarvyNwaokobia/Lepta.git
cd Lepta
pnpm install
cp .env.example .env
# Fill in .env with your keys (see .env.example)
```

### Run

```bash
# Standard Next.js dev
pnpm dev

# With WebSocket real-time engine (reconciliation + agent + settlement loops)
pnpm dev:ws
```

### Wallet Setup

```bash
# Login to Circle CLI
circle wallet login YOUR_EMAIL --type agent --init --testnet

# Create wallet on Arc testnet
circle wallet create --blockchain ARC-TESTNET

# Fund with testnet USDC
circle wallet fund --chain ARC-TESTNET --address YOUR_WALLET
```

### Owncast (for live streaming)

```bash
# Local
./owncast/owncast

# Cloud (on a fresh Ubuntu VPS)
ssh root@YOUR_VPS 'bash -s' < scripts/setup-owncast-cloud.sh
```

Then configure OBS: `rtmp://YOUR_SERVER:1935/live` with your stream key.

## Hackathon Targets

**RFB 4: Streaming & Continuous Payments** — Pay-per-second with start/pause/stop, continuous authorization, real-time metering.

**RFB 6: Creator & Publisher Monetization** — Per-second creator earnings without subscriptions, with provable delivery.

## On-Chain Proof

First Lepta settlement on Arc Testnet:
[`0x76d2c3ad...`](https://testnet.arcscan.app/tx/0x76d2c3ade5d1e2d8453c890491b5891e4d530a506764883276b8bd87bb1f69b8)

Seller wallet: `0x831cbecdf8379cc7d0b34776b13e1be8eb1cff55`
Buyer wallet: `0xf638D33b77e08Ff006Cd1c431440d3A9361A305b`

## License

MIT
