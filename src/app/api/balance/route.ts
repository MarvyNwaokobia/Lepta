import { NextRequest, NextResponse } from "next/server";
import { getBuyerBalances } from "@/lib/circle/gateway";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  try {
    const balances = await getBuyerBalances();

    return NextResponse.json({
      address: address ?? process.env.BUYER_ADDRESS,
      wallet: {
        balance: balances.wallet.formatted,
      },
      gateway: {
        total: balances.gateway.formattedTotal,
        available: balances.gateway.formattedAvailable,
        withdrawing: balances.gateway.formattedWithdrawing,
      },
      network: "ARC-TESTNET",
      chain_id: 5042002,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch balances", details: String(err) },
      { status: 500 }
    );
  }
}
