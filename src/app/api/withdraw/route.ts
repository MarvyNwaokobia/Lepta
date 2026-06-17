import { NextRequest, NextResponse } from "next/server";
import { withdrawFromGateway } from "@/lib/circle/gateway";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { amount, chain } = body;

  if (!amount || parseFloat(amount) <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  try {
    const result = await withdrawFromGateway(amount, {
      chain: chain ?? "arcTestnet",
    });

    return NextResponse.json({
      success: true,
      mintTxHash: result.mintTxHash,
      amount: result.formattedAmount,
      sourceChain: result.sourceChain,
      destinationChain: result.destinationChain,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Withdrawal failed", details: String(err) },
      { status: 500 }
    );
  }
}
