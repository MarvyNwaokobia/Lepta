import { NextRequest, NextResponse } from "next/server";
import { runAgentTick, getRecentDecisions } from "@/lib/agent";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    session_id,
    remaining_budget,
    current_rate,
    daily_cap,
    engagement_signal,
    elapsed_watch_seconds,
    total_spent,
  } = body;

  if (!session_id) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const decision = await runAgentTick(session_id, {
    remaining_budget: remaining_budget ?? 1.0,
    current_rate: current_rate ?? 0.001,
    daily_cap: daily_cap ?? 1.0,
    engagement_signal: engagement_signal ?? 0.5,
    elapsed_watch_seconds: elapsed_watch_seconds ?? 0,
    total_spent: total_spent ?? 0,
  });

  return NextResponse.json(decision);
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 }
    );
  }

  const decisions = getRecentDecisions(sessionId);
  return NextResponse.json(decisions);
}
