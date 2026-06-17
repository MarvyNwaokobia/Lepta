import { NextRequest, NextResponse } from "next/server";
import { requirePayment } from "@/lib/circle/x402-middleware";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get("stream_id");
  if (!streamId) {
    return NextResponse.json({ error: "Missing stream_id" }, { status: 400 });
  }

  const db = getDb();
  const stream = db
    .prepare("SELECT * FROM streams WHERE stream_id = ? AND status = 'live'")
    .get(streamId) as { rate_per_second: number; title: string } | undefined;

  if (!stream) {
    return NextResponse.json(
      { error: "Stream not found or not live" },
      { status: 404 }
    );
  }

  const price = `$${stream.rate_per_second.toFixed(6)}`;
  const result = await requirePayment(req, price);

  if (!result.paid) {
    return result.response;
  }

  return NextResponse.json({
    access: "granted",
    stream_id: streamId,
    title: stream.title,
    paid_by: result.payment.payer,
    amount_usdc: result.payment.amount,
    network: result.payment.network,
    settlement_id: result.payment.transaction,
  });
}
