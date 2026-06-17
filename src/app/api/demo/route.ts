import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { createAttestation } from "@/lib/attestor";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action ?? "start";

  if (action === "start") {
    return startDemo();
  } else if (action === "tick") {
    return demoTick(body.stream_id);
  } else if (action === "stop") {
    return stopDemo(body.stream_id);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

function startDemo() {
  const db = getDb();
  const streamId = uuidv4();

  db.prepare(`
    INSERT INTO streams (stream_id, creator_id, title, rate_per_second, status, rtmp_key, hls_playlist_url, started_at)
    VALUES (?, ?, ?, ?, 'live', '', '', ?)
  `).run(streamId, "demo_creator", "Demo Stream — Lepta Proof of Flow", 0.001, Date.now());

  const viewerSessionId = uuidv4();
  db.prepare(`
    INSERT INTO viewer_sessions
    (session_id, stream_id, viewer_wallet, rate_per_second, daily_cap_usdc, status, started_at, last_segment_acked, network, total_accrued)
    VALUES (?, ?, ?, ?, 1.0, 'active', ?, -1, 'testnet', 0.0)
  `).run(viewerSessionId, streamId, "0xf638D33b77e08Ff006Cd1c431440d3A9361A305b", 0.001, Date.now());

  for (let i = 0; i < 5; i++) {
    const fakeSegment = crypto.randomBytes(1024);
    createAttestation(streamId, i, fakeSegment);

    db.prepare(`
      INSERT INTO client_heartbeats (session_id, segment_index, rendered_at, buffer_health, player_state)
      VALUES (?, ?, ?, ?, 'playing')
    `).run(viewerSessionId, i, Date.now() + i * 2000, 3.5);
  }

  return NextResponse.json({
    stream_id: streamId,
    session_id: viewerSessionId,
    message: "Demo started with 5 pre-attested segments",
    viewer_url: `/viewer/${streamId}`,
    creator_url: `/creator`,
  });
}

function demoTick(streamId: string) {
  if (!streamId) {
    return NextResponse.json({ error: "Missing stream_id" }, { status: 400 });
  }

  const db = getDb();

  const lastAttestation = db
    .prepare(
      "SELECT MAX(segment_index) as last_seg FROM segment_attestations WHERE stream_id = ?"
    )
    .get(streamId) as { last_seg: number | null };

  const nextSeg = (lastAttestation.last_seg ?? -1) + 1;
  const fakeSegment = crypto.randomBytes(1024);
  createAttestation(streamId, nextSeg, fakeSegment);

  const sessions = db
    .prepare(
      "SELECT session_id FROM viewer_sessions WHERE stream_id = ? AND status = 'active'"
    )
    .all(streamId) as { session_id: string }[];

  for (const session of sessions) {
    db.prepare(`
      INSERT INTO client_heartbeats (session_id, segment_index, rendered_at, buffer_health, player_state)
      VALUES (?, ?, ?, ?, 'playing')
    `).run(session.session_id, nextSeg, Date.now(), 3.0);
  }

  return NextResponse.json({
    segment_index: nextSeg,
    sessions_updated: sessions.length,
  });
}

function stopDemo(streamId: string) {
  if (!streamId) {
    return NextResponse.json({ error: "Missing stream_id" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE streams SET status = 'ended' WHERE stream_id = ?").run(streamId);
  db.prepare(
    "UPDATE viewer_sessions SET status = 'ended' WHERE stream_id = ?"
  ).run(streamId);

  return NextResponse.json({ message: "Demo stopped" });
}

export async function GET() {
  return NextResponse.json({
    usage: "POST with {action: 'start'} to begin, {action: 'tick', stream_id} to add segments, {action: 'stop', stream_id} to end",
  });
}
