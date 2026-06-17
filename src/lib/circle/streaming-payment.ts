import { GatewayClient } from "@circle-fin/x402-batching/client";
import { getDb } from "../db";
import type { Hex } from "viem";

const FACILITATOR_URL = "https://gateway-api-testnet.circle.com";
const ARC_TESTNET_NETWORK = "eip155:5042002";

export interface StreamingPaymentSession {
  sessionId: string;
  viewerWallet: string;
  sellerAddress: string;
  ratePerSecond: number;
  totalAuthorized: number;
  totalSettled: number;
  lastSettlementAt: number;
}

export async function settleAccruedAmount(
  sessionId: string
): Promise<{
  success: boolean;
  settlementId: string | null;
  amount: number;
  error?: string;
}> {
  const db = getDb();

  const session = db
    .prepare(
      `SELECT session_id, viewer_wallet, total_accrued, stream_id
       FROM viewer_sessions WHERE session_id = ?`
    )
    .get(sessionId) as {
    session_id: string;
    viewer_wallet: string;
    total_accrued: number;
    stream_id: string;
  } | undefined;

  if (!session || session.total_accrued <= 0) {
    return { success: false, settlementId: null, amount: 0, error: "Nothing to settle" };
  }

  const lastBatch = db
    .prepare(
      `SELECT settled_at FROM settlement_batches
       WHERE session_ids LIKE ? ORDER BY settled_at DESC LIMIT 1`
    )
    .get(`%${sessionId}%`) as { settled_at: number } | undefined;

  const alreadySettled = lastBatch
    ? db
        .prepare(
          `SELECT COALESCE(SUM(total_amount), 0) as settled
           FROM settlement_batches WHERE session_ids LIKE ?`
        )
        .get(`%${sessionId}%`) as { settled: number }
    : { settled: 0 };

  const unsettled = session.total_accrued - alreadySettled.settled;
  if (unsettled <= 0.000001) {
    return { success: true, settlementId: null, amount: 0 };
  }

  const sellerAddress = process.env.SELLER_ADDRESS;
  if (!sellerAddress) {
    return {
      success: false,
      settlementId: null,
      amount: unsettled,
      error: "No seller address configured",
    };
  }

  try {
    const amountAtomic = Math.round(unsettled * 1e6).toString();

    const res = await fetch(`${FACILITATOR_URL}/v1/x402/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 1,
          payload: {
            amount: amountAtomic,
            from: session.viewer_wallet,
            to: sellerAddress,
          },
        },
        paymentRequirements: {
          scheme: "exact",
          network: ARC_TESTNET_NETWORK,
          asset: "USDC",
          amount: amountAtomic,
          payTo: sellerAddress,
          maxTimeoutSeconds: 300,
        },
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        success: boolean;
        transaction: string;
      };
      return {
        success: data.success,
        settlementId: data.transaction,
        amount: unsettled,
      };
    }

    const errText = await res.text();
    console.warn(`[StreamingPayment] Settle failed: ${res.status}`, errText);

    return {
      success: false,
      settlementId: null,
      amount: unsettled,
      error: `Gateway error: ${res.status}`,
    };
  } catch (err) {
    return {
      success: false,
      settlementId: null,
      amount: unsettled,
      error: String(err),
    };
  }
}

export async function getViewerGatewayBalance(
  privateKey: Hex
): Promise<{ wallet: string; gateway: string }> {
  try {
    const rpcUrl = process.env.ARC_TESTNET_RPC;
    const client = new GatewayClient({
      chain: "arcTestnet",
      privateKey,
      ...(rpcUrl ? { rpcUrl } : {}),
    });
    const balances = await client.getBalances();
    return {
      wallet: balances.wallet.formatted,
      gateway: balances.gateway.formattedAvailable,
    };
  } catch {
    return { wallet: "0", gateway: "0" };
  }
}
