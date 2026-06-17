import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db";
import type { SettlementBatch } from "./types";

const BATCH_INTERVAL_MS = 15_000; // flush every 15 seconds

export function flushSettlement(streamId: string): SettlementBatch | null {
  const db = getDb();

  const activeSessions = db
    .prepare(
      `SELECT session_id, total_accrued FROM viewer_sessions
       WHERE stream_id = ? AND status IN ('active', 'paused') AND total_accrued > 0`
    )
    .all(streamId) as { session_id: string; total_accrued: number }[];

  if (activeSessions.length === 0) return null;

  const lastBatch = db
    .prepare(
      `SELECT settled_at FROM settlement_batches
       ORDER BY settled_at DESC LIMIT 1`
    )
    .get() as { settled_at: number } | undefined;

  if (lastBatch && Date.now() - lastBatch.settled_at < BATCH_INTERVAL_MS) {
    return null;
  }

  const totalAmount = activeSessions.reduce(
    (sum, s) => sum + s.total_accrued,
    0
  );
  const sessionIds = activeSessions.map((s) => s.session_id);

  const batch: SettlementBatch = {
    batch_id: uuidv4(),
    session_ids: sessionIds,
    total_amount: totalAmount,
    gateway_tx_hash: null, // will be filled by Circle Gateway call
    settled_at: Date.now(),
  };

  db.prepare(`
    INSERT INTO settlement_batches (batch_id, session_ids, total_amount, gateway_tx_hash, settled_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    batch.batch_id,
    JSON.stringify(batch.session_ids),
    batch.total_amount,
    batch.gateway_tx_hash,
    batch.settled_at
  );

  // TODO: Call Circle Gateway API here to actually settle USDC
  // For now, we log and track locally
  // await settleViaGateway(batch);

  return batch;
}

export function getSettlementHistory(
  limit: number = 20
): SettlementBatch[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM settlement_batches ORDER BY settled_at DESC LIMIT ?`
    )
    .all(limit) as (Omit<SettlementBatch, "session_ids"> & {
    session_ids: string;
  })[];

  return rows.map((r) => ({
    ...r,
    session_ids: JSON.parse(r.session_ids),
  }));
}
