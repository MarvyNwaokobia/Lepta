import { getDb } from "./db";
import type { MeterTick, ViewerSession } from "./types";

const SEGMENT_TOLERANCE = 2; // client can be up to 2 segments behind
const HEARTBEAT_TIMEOUT_MS = 4000;

export interface ReconciliationResult {
  tick: MeterTick;
  sessionUpdate: Partial<ViewerSession>;
}

export function reconcile(
  sessionId: string,
  streamId: string,
  ratePerSecond: number
): ReconciliationResult {
  const db = getDb();
  const now = Date.now();

  const serverLatest = db
    .prepare(
      `SELECT segment_index FROM segment_attestations
       WHERE stream_id = ? ORDER BY segment_index DESC LIMIT 1`
    )
    .get(streamId) as { segment_index: number } | undefined;

  const clientLatest = db
    .prepare(
      `SELECT segment_index, rendered_at FROM client_heartbeats
       WHERE session_id = ? ORDER BY rendered_at DESC LIMIT 1`
    )
    .get(sessionId) as
    | { segment_index: number; rendered_at: number }
    | undefined;

  const serverSeg = serverLatest?.segment_index ?? -1;
  const clientSeg = clientLatest?.segment_index ?? -1;
  const lastHeartbeatAge = clientLatest
    ? now - clientLatest.rendered_at
    : Infinity;

  let match = false;
  let reason: string | null = null;
  let accrued = 0;

  if (serverSeg < 0) {
    reason = "stream not emitting segments";
  } else if (clientSeg < 0 || lastHeartbeatAge > HEARTBEAT_TIMEOUT_MS) {
    reason = `no client heartbeat for ${Math.round(lastHeartbeatAge / 1000)}s`;
  } else if (serverSeg - clientSeg > SEGMENT_TOLERANCE) {
    reason = `client ${serverSeg - clientSeg} segments behind (tolerance: ${SEGMENT_TOLERANCE})`;
  } else {
    match = true;
    accrued = ratePerSecond;
  }

  const tick: MeterTick = {
    session_id: sessionId,
    second_timestamp: now,
    server_segment_at_t: serverSeg,
    client_segment_at_t: clientSeg,
    match,
    accrued_amount: accrued,
    reason_if_paused: reason,
  };

  db.prepare(`
    INSERT OR REPLACE INTO meter_ticks
    (session_id, second_timestamp, server_segment_at_t, client_segment_at_t, match, accrued_amount, reason_if_paused)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    tick.session_id,
    tick.second_timestamp,
    tick.server_segment_at_t,
    tick.client_segment_at_t,
    tick.match ? 1 : 0,
    tick.accrued_amount,
    tick.reason_if_paused
  );

  const sessionUpdate: Partial<ViewerSession> = {
    last_segment_acked: match ? clientSeg : undefined,
    status: match ? "active" : "paused",
  };

  if (match) {
    db.prepare(`
      UPDATE viewer_sessions
      SET total_accrued = total_accrued + ?, last_segment_acked = ?, status = 'active'
      WHERE session_id = ?
    `).run(accrued, clientSeg, sessionId);
  } else {
    db.prepare(`
      UPDATE viewer_sessions SET status = 'paused' WHERE session_id = ?
    `).run(sessionId);
  }

  return { tick, sessionUpdate };
}

export function getSessionAccrued(sessionId: string): number {
  const db = getDb();
  const row = db
    .prepare(`SELECT total_accrued FROM viewer_sessions WHERE session_id = ?`)
    .get(sessionId) as { total_accrued: number } | undefined;
  return row?.total_accrued ?? 0;
}

export function checkCapReached(sessionId: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT total_accrued, daily_cap_usdc FROM viewer_sessions WHERE session_id = ?`
    )
    .get(sessionId) as
    | { total_accrued: number; daily_cap_usdc: number }
    | undefined;
  if (!row) return false;
  return row.total_accrued >= row.daily_cap_usdc;
}
