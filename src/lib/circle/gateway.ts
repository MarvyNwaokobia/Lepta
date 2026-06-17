// Circle Gateway integration for nanopayment settlement on Arc
// Docs: https://developers.circle.com/

export interface GatewayConfig {
  apiKey: string;
  environment: "sandbox" | "production";
  baseUrl: string;
}

export function getGatewayConfig(): GatewayConfig {
  return {
    apiKey: process.env.CIRCLE_API_KEY ?? "",
    environment:
      (process.env.CIRCLE_ENV as "sandbox" | "production") ?? "sandbox",
    baseUrl:
      process.env.CIRCLE_ENV === "production"
        ? "https://api.circle.com"
        : "https://api-sandbox.circle.com",
  };
}

export interface NanopaymentRequest {
  recipientWallet: string;
  amount: string; // USDC amount as string for precision
  currency: "USDC" | "EURC";
  chain: "ARC";
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export async function settleViaGateway(
  request: NanopaymentRequest
): Promise<{ txHash: string; status: string }> {
  const config = getGatewayConfig();

  if (!config.apiKey) {
    console.warn("[Gateway] No API key configured — settlement simulated");
    return {
      txHash: `sim_${request.idempotencyKey}`,
      status: "simulated",
    };
  }

  // Real Gateway API call
  const response = await fetch(`${config.baseUrl}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotencyKey: request.idempotencyKey,
      amount: { amount: request.amount, currency: request.currency },
      destination: {
        type: "blockchain",
        chain: request.chain,
        address: request.recipientWallet,
      },
      metadata: request.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway settlement failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    txHash: data.data?.transactionHash ?? data.id,
    status: data.data?.status ?? "pending",
  };
}
