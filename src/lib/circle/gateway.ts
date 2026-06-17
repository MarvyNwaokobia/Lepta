import {
  createGatewayMiddleware,
  BatchFacilitatorClient,
  type GatewayMiddleware,
  type PaymentRequest,
} from "@circle-fin/x402-batching/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import type { Hex } from "viem";

const SELLER_ADDRESS = process.env.SELLER_ADDRESS ?? "";
const BUYER_PRIVATE_KEY = (process.env.BUYER_PRIVATE_KEY ?? "") as Hex;
const FACILITATOR_URL = "https://gateway-api-testnet.circle.com";
const ARC_TESTNET_NETWORK = "eip155:5042002";
const ARC_EXPLORER = "https://testnet.arcscan.app";

let _gateway: GatewayMiddleware | null = null;

export function getGateway(): GatewayMiddleware {
  if (!_gateway) {
    _gateway = createGatewayMiddleware({
      sellerAddress: SELLER_ADDRESS,
      facilitatorUrl: FACILITATOR_URL,
      networks: [ARC_TESTNET_NETWORK],
    });
  }
  return _gateway;
}

let _facilitator: BatchFacilitatorClient | null = null;

export function getFacilitator(): BatchFacilitatorClient {
  if (!_facilitator) {
    _facilitator = new BatchFacilitatorClient({
      url: FACILITATOR_URL,
    });
  }
  return _facilitator;
}

let _buyerClient: GatewayClient | null = null;

export function getBuyerClient(): GatewayClient {
  if (!_buyerClient) {
    if (!BUYER_PRIVATE_KEY) {
      throw new Error("BUYER_PRIVATE_KEY not configured");
    }
    const rpcUrl = process.env.ARC_TESTNET_RPC;
    _buyerClient = new GatewayClient({
      chain: "arcTestnet",
      privateKey: BUYER_PRIVATE_KEY,
      ...(rpcUrl ? { rpcUrl } : {}),
    });
  }
  return _buyerClient;
}

export async function getBuyerBalances() {
  const client = getBuyerClient();
  return client.getBalances();
}

export async function depositToGateway(amount: string) {
  const client = getBuyerClient();
  return client.deposit(amount);
}

export async function payForResource<T = unknown>(url: string) {
  const client = getBuyerClient();
  return client.pay<T>(url);
}

export async function withdrawFromGateway(
  amount: string,
  options?: { chain?: "arcTestnet"; recipient?: `0x${string}` }
) {
  const client = getBuyerClient();
  return client.withdraw(amount, options);
}

export async function lookupSettlement(
  settlementId: string
): Promise<{ status: string; txHash: string | null; explorerUrl: string | null }> {
  const res = await fetch(
    `${FACILITATOR_URL}/v1/x402/transfers/${settlementId}`
  );
  if (!res.ok) {
    return { status: "unknown", txHash: null, explorerUrl: null };
  }
  const data = (await res.json()) as {
    status: string;
    updatedAt: string;
  };

  if (data.status !== "completed" && data.status !== "confirmed") {
    return { status: data.status, txHash: null, explorerUrl: null };
  }

  const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
  const txRes = await fetch(
    `${ARC_EXPLORER}/api/v2/addresses/${GATEWAY_WALLET}/transactions?filter=to`
  );
  if (!txRes.ok) {
    return { status: data.status, txHash: null, explorerUrl: null };
  }

  const { items } = (await txRes.json()) as {
    items: { hash: string; timestamp: string; method: string | null }[];
  };
  const updatedAt = new Date(data.updatedAt).getTime();
  const candidate = items.find(
    (t) =>
      t.method === "submitBatch" &&
      new Date(t.timestamp).getTime() <= updatedAt + 5_000
  );

  return {
    status: data.status,
    txHash: candidate?.hash ?? null,
    explorerUrl: candidate
      ? `${ARC_EXPLORER}/tx/${candidate.hash}`
      : null,
  };
}

export function extractPaymentInfo(req: PaymentRequest) {
  return req.payment ?? null;
}

export { type GatewayMiddleware, type PaymentRequest };
