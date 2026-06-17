import { NextRequest, NextResponse } from "next/server";
import {
  flushSettlement,
  resolveSettlementTx,
  getSettlementHistory,
} from "@/lib/settlement";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stream_id, settlement_id } = body;

  if (settlement_id) {
    const result = await resolveSettlementTx(settlement_id);
    return NextResponse.json(result);
  }

  if (!stream_id) {
    return NextResponse.json({ error: "Missing stream_id" }, { status: 400 });
  }

  const batch = await flushSettlement(stream_id);
  if (!batch) {
    return NextResponse.json({ message: "Nothing to settle or too soon" });
  }

  return NextResponse.json(batch, { status: 201 });
}

export async function GET() {
  const history = getSettlementHistory();
  return NextResponse.json(history);
}
