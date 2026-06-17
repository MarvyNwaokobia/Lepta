import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";

const MIN_CAP = 0.1;
const MAX_CAP = 100;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stream_id, viewer_wallet, daily_cap_usdc, network } = body;

  if (!stream_id || !viewer_wallet) {
    return NextResponse.json(
      { error: "Missing stream_id or viewer_wallet" },
      { status: 400 }
    );
  }

  const db = getDb();

  const stream = db
    .prepare("SELECT * FROM streams WHERE stream_id = ? AND status = 'live'")
    .get(stream_id) as { rate_per_second: number } | undefined;

  if (!stream) {
    return NextResponse.json(
      { error: "Stream not found or not live" },
      { status: 404 }
    );
  }

  const cap = Math.min(MAX_CAP, Math.max(MIN_CAP, daily_cap_usdc ?? 1.0));

  const session = {
    session_id: uuidv4(),
    stream_id,
    viewer_wallet,
    rate_per_second: stream.rate_per_second,
    daily_cap_usdc: cap,
    status: "active",
    started_at: Date.now(),
    last_segment_acked: -1,
    network: network ?? "testnet",
    total_accrued: 0,
  };

  db.prepare(`
    INSERT INTO viewer_sessions
    (session_id, stream_id, viewer_wallet, rate_per_second, daily_cap_usdc, status, started_at, last_segment_acked, network, total_accrued)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.session_id,
    session.stream_id,
    session.viewer_wallet,
    session.rate_per_second,
    session.daily_cap_usdc,
    session.status,
    session.started_at,
    session.last_segment_acked,
    session.network,
    session.total_accrued
  );

  return NextResponse.json(session, { status: 201 });
}

export async function GET(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get("stream_id");
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const db = getDb();

  if (sessionId) {
    const session = db
      .prepare("SELECT * FROM viewer_sessions WHERE session_id = ?")
      .get(sessionId);
    return NextResponse.json(session ?? { error: "Not found" });
  }

  if (streamId) {
    const sessions = db
      .prepare(
        "SELECT * FROM viewer_sessions WHERE stream_id = ? ORDER BY started_at DESC"
      )
      .all(streamId);
    return NextResponse.json(sessions);
  }

  return NextResponse.json({ error: "Provide stream_id or session_id" }, { status: 400 });
}
