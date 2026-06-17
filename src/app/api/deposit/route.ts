import { NextRequest, NextResponse } from "next/server";
import { depositToGateway, getBuyerBalances } from "@/lib/circle/gateway";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { amount } = body;

  if (!amount || parseFloat(amount) <= 0) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400 }
    );
  }

  try {
    const result = await depositToGateway(amount);

    return NextResponse.json({
      success: true,
      depositTxHash: result.depositTxHash,
      amount: result.formattedAmount,
      depositor: result.depositor,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Deposit failed", details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const balances = await getBuyerBalances();
    return NextResponse.json({
      gateway_available: balances.gateway.formattedAvailable,
      wallet_balance: balances.wallet.formatted,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch balance", details: String(err) },
      { status: 500 }
    );
  }
}
