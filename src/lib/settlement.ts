import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db";
import type { SettlementBatch } from "./types";
import { getFacilitator, lookupSettlement } from "./circle/gateway";

const BATCH_INTERVAL_MS = 15_000;
const FACILITATOR_URL = "https://gateway-api-testnet.circle.com";
const ARC_TESTNET_NETWORK = "eip155:5042002";

export async function flushSettlement(
  streamId: string
): Promise<SettlementBatch | null> {
  const db = getDb();

  const activeSessions = db
    .prepare(
      `SELECT session_id, total_accrued, viewer_wallet FROM viewer_sessions
       WHERE stream_id = ? AND status IN ('active', 'paused') AND total_accrued > 0`
    )
    .all(streamId) as {
    session_id: string;
    total_accrued: number;
    viewer_wallet: string;
  }[];

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
  const batchId = uuidv4();

  let gatewayTxHash: string | null = null;

  try {
    const sellerAddress = process.env.SELLER_ADDRESS;
    if (sellerAddress) {
      const settleRes = await fetch(
        `${FACILITATOR_URL}/v1/x402/transfers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "USDC",
            amount: Math.round(totalAmount * 1e6).toString(),
            network: ARC_TESTNET_NETWORK,
            toAddress: sellerAddress,
            idempotencyKey: batchId,
          }),
        }
      );

      if (settleRes.ok) {
        const settleData = (await settleRes.json()) as {
          id: string;
          status: string;
        };
        gatewayTxHash = settleData.id;
        console.log(
          `[Settlement] Batch ${batchId}: $${totalAmount.toFixed(6)} USDC → ${sellerAddress} (id: ${settleData.id})`
        );
      } else {
        console.warn(
          `[Settlement] Gateway settle failed: ${settleRes.status}`,
          await settleRes.text()
        );
      }
    }
  } catch (err) {
    console.warn("[Settlement] Gateway call failed, recording locally:", err);
  }

  const batch: SettlementBatch = {
    batch_id: batchId,
    session_ids: sessionIds,
    total_amount: totalAmount,
    gateway_tx_hash: gatewayTxHash,
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

  return batch;
}

export async function resolveSettlementTx(
  settlementId: string
): Promise<{
  status: string;
  txHash: string | null;
  explorerUrl: string | null;
}> {
  return lookupSettlement(settlementId);
}

export function getSettlementHistory(limit: number = 20): SettlementBatch[] {
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
