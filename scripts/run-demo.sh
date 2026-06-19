#!/usr/bin/env bash
#
# Lepta Demo Runner
# Run this in a visible terminal during your video recording.
# It walks through the full flow with pauses for you to narrate.
#
# Usage: ./scripts/run-demo.sh [port]
#   Default port: 3001
#

set -euo pipefail

PORT="${1:-3001}"
BASE="http://localhost:$PORT"
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
DIM='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

pause() {
  echo ""
  echo -e "${DIM}  [press enter to continue]${NC}"
  read -r
}

echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║         LEPTA — LIVE DEMO RUNNER          ║"
echo "  ║   Pay-per-second livestream payments      ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Step 1: Start demo stream
echo -e "${YELLOW}━━━ STEP 1: Start demo stream ━━━${NC}"
echo -e "${DIM}Creating stream with 5 pre-attested HLS segments...${NC}"
echo ""

DEMO=$(curl -s -X POST $BASE/api/demo \
  -H "Content-Type: application/json" \
  -d '{"action":"start"}')

STREAM_ID=$(echo "$DEMO" | python3 -c "import sys,json; print(json.load(sys.stdin)['stream_id'])")
SESSION_ID=$(echo "$DEMO" | python3 -c "import sys,json; print(json.load(sys.stdin)['session_id'])")

echo -e "${GREEN}  Stream:  ${BOLD}$STREAM_ID${NC}"
echo -e "${GREEN}  Session: ${BOLD}$SESSION_ID${NC}"
echo -e "${GREEN}  Viewer:  ${BOLD}$BASE/viewer/$STREAM_ID${NC}"
echo -e "${GREEN}  Creator: ${BOLD}$BASE/creator${NC}"
echo ""
echo -e "${DIM}  5 segments attested with SHA-256 hashes${NC}"

pause

# Step 2: Show attestations
echo -e "${YELLOW}━━━ STEP 2: Proof-of-flow attestation ━━━${NC}"
echo -e "${DIM}Latest server-side segment attestation:${NC}"
echo ""

curl -s "$BASE/api/attestations?stream_id=$STREAM_ID" | python3 -m json.tool

pause

# Step 3: Send heartbeats (client-side attestation)
echo -e "${YELLOW}━━━ STEP 3: Client heartbeats ━━━${NC}"
echo -e "${DIM}Simulating viewer watching — sending heartbeats...${NC}"
echo ""

for i in 3 4; do
  curl -s -X POST $BASE/api/heartbeat \
    -H "Content-Type: application/json" \
    -d "{\"session_id\":\"$SESSION_ID\",\"segment_index\":$i,\"rendered_at\":$(python3 -c 'import time; print(int(time.time()*1000))'),\"buffer_health\":3.5,\"player_state\":\"playing\"}" > /dev/null
  echo -e "${GREEN}  Heartbeat sent: segment $i, playing, buffer 3.5s${NC}"
  sleep 0.5
done

pause

# Step 4: Add more segments (stream continues)
echo -e "${YELLOW}━━━ STEP 4: Stream continues — new segments ━━━${NC}"
echo -e "${DIM}Owncast emits more HLS segments...${NC}"
echo ""

for i in $(seq 1 3); do
  TICK=$(curl -s -X POST $BASE/api/demo \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"tick\",\"stream_id\":\"$STREAM_ID\"}")
  SEG=$(echo "$TICK" | python3 -c "import sys,json; print(json.load(sys.stdin)['segment_index'])")
  echo -e "${GREEN}  Segment $SEG attested + heartbeat acked${NC}"
  sleep 0.8
done

pause

# Step 5: Agent decision (the money shot)
echo -e "${YELLOW}━━━ STEP 5: Budget agent reasoning ━━━${NC}"
echo -e "${DIM}Agent evaluates: should the viewer keep paying?${NC}"
echo ""

echo -e "${CYAN}  Scenario A: Healthy — budget OK, engagement high${NC}"
AGENT1=$(curl -s -X POST $BASE/api/agent \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"remaining_budget\":0.85,\"current_rate\":0.001,\"daily_cap\":1.0,\"engagement_signal\":0.72,\"elapsed_watch_seconds\":150,\"total_spent\":0.15}")
DECISION1=$(echo "$AGENT1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Decision: {d[\"decision\"]}\n  Reasoning: {d[\"reasoning_text\"]}')")
echo -e "${GREEN}$DECISION1${NC}"
echo ""

sleep 2

echo -e "${CYAN}  Scenario B: Critical — budget nearly gone, engagement dead${NC}"
AGENT2=$(curl -s -X POST $BASE/api/agent \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"remaining_budget\":0.015,\"current_rate\":0.001,\"daily_cap\":1.0,\"engagement_signal\":0.03,\"elapsed_watch_seconds\":985,\"total_spent\":0.985}")
DECISION2=$(echo "$AGENT2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Decision: {d[\"decision\"]}\n  Reasoning: {d[\"reasoning_text\"]}')")
echo -e "${GREEN}$DECISION2${NC}"

pause

# Step 6: Check balances (real on-chain)
echo -e "${YELLOW}━━━ STEP 6: Real USDC on Arc Testnet ━━━${NC}"
echo -e "${DIM}Querying on-chain balances...${NC}"
echo ""

BAL=$(curl -s $BASE/api/balance)
WALLET=$(echo "$BAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['wallet']['balance'])")
GATEWAY=$(echo "$BAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['gateway']['available'])")
ADDR=$(echo "$BAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['address'])")

echo -e "${GREEN}  Wallet:  ${BOLD}$WALLET USDC${NC}  ${DIM}(on Arc Testnet)${NC}"
echo -e "${GREEN}  Gateway: ${BOLD}$GATEWAY USDC${NC}  ${DIM}(available for payments)${NC}"
echo -e "${DIM}  Address: $ADDR${NC}"
echo -e "${DIM}  Explorer: https://testnet.arcscan.app/address/$ADDR${NC}"

pause

# Step 7: Safety rails
echo -e "${YELLOW}━━━ STEP 7: Safety rails ━━━${NC}"
echo -e "${DIM}Rate limiting prevents session spam...${NC}"
echo ""

curl -s -X POST $BASE/api/sessions \
  -H "Content-Type: application/json" \
  -d "{\"stream_id\":\"$STREAM_ID\",\"viewer_wallet\":\"0xtest_rate_limit\"}" > /dev/null

RAIL=$(curl -s -X POST $BASE/api/sessions \
  -H "Content-Type: application/json" \
  -d "{\"stream_id\":\"$STREAM_ID\",\"viewer_wallet\":\"0xtest_rate_limit\"}")
echo -e "${GREEN}  $RAIL${NC}"

pause

# Step 8: End demo
echo -e "${YELLOW}━━━ STEP 8: Stream ends ━━━${NC}"

curl -s -X POST $BASE/api/demo \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"stop\",\"stream_id\":\"$STREAM_ID\"}" > /dev/null

echo -e "${GREEN}  Stream stopped. All sessions ended. Meter paused.${NC}"
echo ""

echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║            DEMO COMPLETE                  ║"
echo "  ║                                           ║"
echo "  ║  Repo:  github.com/MarvyNwaokobia/Lepta  ║"
echo "  ║  Live:  lepta-eight.vercel.app            ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"
