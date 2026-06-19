# Lepta Demo Script — 2:45 Target

## Recording Setup

**Tools needed:**
- Screen recorder: QuickTime (Cmd+Shift+5) or OBS — record at 1920x1080
- Browser: Chrome, dark mode, zoom to 110%
- Two tabs pre-opened: Viewer page + Creator dashboard
- Terminal visible for the demo API calls
- Optional: facecam in bottom-right corner (builds trust with judges)

**Pre-recording checklist:**
1. `pnpm dev:ws` running (port 3001) — the WebSocket server
2. Clean browser — no other tabs, no bookmarks bar
3. Terminal font size bumped up (Cmd+= twice)
4. `.env` has ANTHROPIC_API_KEY set (so the agent gives real LLM responses)
5. No notifications — Do Not Disturb on
6. Delete `lepta.db` for a clean slate before recording

**Audio:** Record voiceover live or dub after. Speak slowly, confidently. Judges are skimming — every sentence must carry weight.

---

## THE SCRIPT

### INTRO — 0:00 to 0:15 (15 seconds)

**[Show: Landing page at localhost:3001]**

> "This is Lepta — pay-per-second livestream payments, provably delivered, settled in USDC on Arc."

**[Pause 1 beat on the landing page — let them read the three cards: Proof of Flow, Streaming Meter, Budget Agent]**

> "Every hackathon project so far does per-call or per-article payments. Nobody's built continuous streaming payments with proof that content was actually delivered. That's the gap Lepta fills."

---

### THE CREATOR GOES LIVE — 0:15 to 0:40 (25 seconds)

**[Click "Go Live" → Creator setup page]**

> "As a creator, I set my per-second rate..."

**[Type: "Building Lepta — Live Hackathon Stream" as title]**
**[Set rate to 0.001 — show the auto-calculated "$3.60/hr per viewer"]**

> "One-tenth of a cent per second. Three-sixty an hour. No subscriptions, no paywalls — just a meter that runs while I stream."

**[Click "Go Live"]**

**[Creator dashboard appears — show the empty state briefly]**

> "Dashboard is live. Zero viewers, zero earnings. Let's change that."

---

### START THE DEMO ENGINE — 0:40 to 0:55 (15 seconds)

**[Switch to terminal]**

> "I'll start the proof-of-flow engine. In production this watches real HLS segments from Owncast. For the demo, I'm simulating segments."

**[Run in terminal:]**
```
curl -s -X POST http://localhost:3001/api/demo \
  -H "Content-Type: application/json" \
  -d '{"action":"start"}' | python3 -m json.tool
```

**[Show the JSON response — stream_id, session_id, "5 pre-attested segments"]**

> "Five segments attested — each one hashed and timestamped server-side."

---

### THE VIEWER EXPERIENCE — 0:55 to 1:30 (35 seconds)

**[Switch to Viewer tab — use the stream_id from the demo response]**

> "Here's what a viewer sees."

**[Point out the key elements as you hover over them:]**

> "The meter — flowing at a tenth of a cent per second. This isn't a timer. It only runs when the proof-of-flow oracle confirms content was actually delivered."

**[Point to Proof of Flow card]**

> "Server segments, client acknowledgments, match rate. If my stream stalls, the meter pauses automatically. You don't pay for dead air."

**[Click "Connect & Start Paying"]**

> "The viewer connects their wallet, sets a session cap, and the meter starts. Real USDC, real Arc testnet transactions."

**[Let the meter tick for a few seconds — the dollar amount climbing visibly]**

---

### THE AGENT — THE MONEY SHOT — 1:30 to 2:00 (30 seconds)

**[Point to Agent Reasoning panel]**

> "This is the part that matters for agentic sophistication. Every ten seconds, a Claude agent evaluates: should I keep paying?"

**[Wait for an agent tick to appear in the feed — or trigger one via terminal:]**
```
curl -s -X POST http://localhost:3001/api/agent \
  -H "Content-Type: application/json" \
  -d '{"session_id":"SESSION_ID_HERE","remaining_budget":0.95,"current_rate":0.001,"daily_cap":1.0,"engagement_signal":0.7,"elapsed_watch_seconds":50,"total_spent":0.05}'
```

**[Show the agent's reasoning text appearing in the feed]**

> "It's not just automation — the agent reasons about remaining budget, engagement signal, and rate. When engagement drops or budget runs low, it pauses the meter and explains why. That reasoning is logged and visible — judges can literally watch the agent think."

**[If possible, trigger a pause decision by sending low engagement:]**
```
curl -s -X POST http://localhost:3001/api/agent \
  -H "Content-Type: application/json" \
  -d '{"session_id":"SESSION_ID_HERE","remaining_budget":0.02,"current_rate":0.001,"daily_cap":1.0,"engagement_signal":0.05,"elapsed_watch_seconds":300,"total_spent":0.98}'
```

> "Budget nearly gone, engagement dead — agent pauses. No more USDC flows until conditions change."

---

### CREATOR DASHBOARD + SETTLEMENT — 2:00 to 2:25 (25 seconds)

**[Switch to Creator dashboard tab]**

> "Creator side — everything is live."

**[Point to:]**
- Total earnings ticking up
- Active viewers count
- Stream health (attestation match rate, stalls)

> "Attestation match rate shows proof-of-flow is working — server and client segments are in sync."

**[Point to settlement history if any batches have flushed]**

> "Settlements batch through Circle Gateway every 15 seconds. Real USDC on Arc testnet — here's the explorer link."

**[If a settlement exists, click the explorer link to show the Arc testnet transaction]**

> "Gateway balance, cross-chain withdrawal to Base, Arbitrum, Ethereum — all built in."

---

### CLOSE — 2:25 to 2:45 (20 seconds)

**[Switch back to landing page]**

> "Lepta fills the one gap Canteen flagged as open: continuous streaming payments. Not per-call, not per-article — per-second, with cryptographic proof that content was delivered."

> "Built on Circle Gateway, x402, USDC on Arc. The proof-of-flow primitive doesn't exist anywhere else."

> "The repo is public, the app is deployed, and the first real payments are already flowing."

**[Hold on landing page for 2 seconds — end]**

---

## POST-RECORDING

**Edit checklist:**
1. Trim any dead air or loading spinners longer than 2 seconds
2. Add subtle background music (lo-fi, very quiet — optional)
3. Add text overlay in first 3 seconds: "Lepta — Pay-Per-Second Livestream Payments"
4. Add text overlay at end: GitHub URL + live link
5. Export as MP4, 1080p
6. Upload to YouTube (unlisted) or Loom
7. Total runtime must be under 3:00

**Winning touches:**
- If you have time, show a real OBS → Owncast stream instead of the demo API
- Show the Arc testnet explorer with a real settled transaction
- Mention the traction angle: "I streamed the build itself — real viewers, real payments during the hackathon"
- Keep energy high but not hype-y — judges are builders, they respect precision over excitement

---

## KEY PHRASES TO HIT (maps to judging criteria)

**Agentic Sophistication (30%):**
- "The agent reasons about budget, engagement, and rate — not just threshold automation"
- "Reasoning is visible and logged"
- "Pause decisions include explanations"

**Traction (30%):**
- "Real USDC flowing on Arc testnet"
- "Deployed and live at lepta-eight.vercel.app"
- "The first payments are already on-chain"

**Circle Tool Usage (20%):**
- "Gateway batched settlement — not one transaction per second, batched every 15 seconds"
- "x402 paywall for stream access"
- "EIP-3009 TransferWithAuthorization"
- "Cross-chain withdrawal via App Kit"

**Innovation (20%):**
- "Continuous streaming payments — the gap Canteen explicitly flagged"
- "Proof-of-flow: dual-sided attestation, not just a timer"
- "Nobody else has built the pause/resume, rate-authorization primitive"
