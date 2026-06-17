import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { reconcile } from "../meter";
import { runAgentTick } from "../agent";
import { flushSettlement } from "../settlement";
import { EngagementTracker } from "../engagement";
import { getDb } from "../db";

let io: SocketServer | null = null;
let reconciliationInterval: ReturnType<typeof setInterval> | null = null;
let settlementInterval: ReturnType<typeof setInterval> | null = null;

const engagementTrackers = new Map<string, EngagementTracker>();
const RECONCILE_INTERVAL_MS = 1000;
const SETTLEMENT_INTERVAL_MS = 15000;
const AGENT_TICK_INTERVAL_S = 10;

export function initRealtimeEngine(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/ws",
  });

  io.on("connection", (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    socket.on("join_stream", (data: { streamId: string; sessionId: string }) => {
      socket.join(`stream:${data.streamId}`);
      socket.join(`session:${data.sessionId}`);
      console.log(`[WS] ${socket.id} joined stream:${data.streamId} session:${data.sessionId}`);
    });

    socket.on("heartbeat", (data: {
      sessionId: string;
      segmentIndex: number;
      bufferHealth: number;
      playerState: string;
    }) => {
      const db = getDb();
      db.prepare(`
        INSERT INTO client_heartbeats (session_id, segment_index, rendered_at, buffer_health, player_state)
        VALUES (?, ?, ?, ?, ?)
      `).run(data.sessionId, data.segmentIndex, Date.now(), data.bufferHealth, data.playerState);
    });

    socket.on("chat", (data: { streamId: string; message: string }) => {
      const tracker = getOrCreateTracker(data.streamId);
      tracker.addChat();
    });

    socket.on("reaction", (data: { streamId: string }) => {
      const tracker = getOrCreateTracker(data.streamId);
      tracker.addReaction();
    });

    socket.on("disconnect", () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  startReconciliationLoop();
  startSettlementLoop();

  console.log("[Realtime] Engine initialized");
  return io;
}

function startReconciliationLoop() {
  if (reconciliationInterval) clearInterval(reconciliationInterval);

  reconciliationInterval = setInterval(async () => {
    const db = getDb();

    const activeSessions = db
      .prepare(
        `SELECT vs.session_id, vs.stream_id, vs.rate_per_second, vs.total_accrued,
                vs.daily_cap_usdc, vs.started_at
         FROM viewer_sessions vs
         JOIN streams s ON vs.stream_id = s.stream_id
         WHERE vs.status = 'active' AND s.status = 'live'`
      )
      .all() as {
      session_id: string;
      stream_id: string;
      rate_per_second: number;
      total_accrued: number;
      daily_cap_usdc: number;
      started_at: number;
    }[];

    for (const session of activeSessions) {
      const { tick, sessionUpdate } = reconcile(
        session.session_id,
        session.stream_id,
        session.rate_per_second
      );

      if (io) {
        io.to(`session:${session.session_id}`).emit("meter_tick", {
          ...tick,
          total_accrued: session.total_accrued + tick.accrued_amount,
          status: sessionUpdate.status,
        });

        io.to(`stream:${session.stream_id}`).emit("session_update", {
          session_id: session.session_id,
          status: sessionUpdate.status,
          total_accrued: session.total_accrued + tick.accrued_amount,
          match: tick.match,
          reason: tick.reason_if_paused,
        });
      }

      const now = Date.now();
      const elapsedS = (now - session.started_at) / 1000;
      if (Math.floor(elapsedS) % AGENT_TICK_INTERVAL_S === 0 && tick.match) {
        const tracker = getOrCreateTracker(session.stream_id);
        const engagement = tracker.compute();

        try {
          const decision = await runAgentTick(session.session_id, {
            remaining_budget: session.daily_cap_usdc - session.total_accrued,
            current_rate: session.rate_per_second,
            daily_cap: session.daily_cap_usdc,
            engagement_signal: engagement.composite_score,
            elapsed_watch_seconds: elapsedS,
            total_spent: session.total_accrued,
          });

          if (io) {
            io.to(`session:${session.session_id}`).emit("agent_decision", decision);
          }

          if (decision.decision === "pause") {
            db.prepare(
              "UPDATE viewer_sessions SET status = 'paused' WHERE session_id = ?"
            ).run(session.session_id);
          }
        } catch (err) {
          console.error(`[Agent] Tick failed for ${session.session_id}:`, err);
        }
      }
    }
  }, RECONCILE_INTERVAL_MS);
}

function startSettlementLoop() {
  if (settlementInterval) clearInterval(settlementInterval);

  settlementInterval = setInterval(async () => {
    const db = getDb();
    const liveStreams = db
      .prepare("SELECT stream_id FROM streams WHERE status = 'live'")
      .all() as { stream_id: string }[];

    for (const stream of liveStreams) {
      try {
        const batch = await flushSettlement(stream.stream_id);
        if (batch && io) {
          io.to(`stream:${stream.stream_id}`).emit("settlement", {
            batch_id: batch.batch_id,
            total_amount: batch.total_amount,
            session_count: batch.session_ids.length,
            gateway_tx_hash: batch.gateway_tx_hash,
          });
        }
      } catch (err) {
        console.error(`[Settlement] Flush failed for ${stream.stream_id}:`, err);
      }
    }
  }, SETTLEMENT_INTERVAL_MS);
}

function getOrCreateTracker(streamId: string): EngagementTracker {
  let tracker = engagementTrackers.get(streamId);
  if (!tracker) {
    tracker = new EngagementTracker();
    engagementTrackers.set(streamId, tracker);
  }
  return tracker;
}

export function getEngagement(streamId: string) {
  const tracker = getOrCreateTracker(streamId);
  return tracker.compute();
}

export function stopRealtimeEngine() {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
  }
  if (settlementInterval) {
    clearInterval(settlementInterval);
    settlementInterval = null;
  }
  if (io) {
    io.close();
    io = null;
  }
  engagementTrackers.clear();
  console.log("[Realtime] Engine stopped");
}

export function getIO() {
  return io;
}
