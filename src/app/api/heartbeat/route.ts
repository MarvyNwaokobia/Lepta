import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { ClientHeartbeat } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ClientHeartbeat;
  const { session_id, segment_index, rendered_at, buffer_health, player_state } =
    body;

  if (!session_id || segment_index === undefined) {
    return NextResponse.json(
      { error: "Missing session_id or segment_index" },
      { status: 400 }
    );
  }

  const db = getDb();

  const session = db
    .prepare("SELECT session_id FROM viewer_sessions WHERE session_id = ?")
    .get(session_id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  db.prepare(`
    INSERT INTO client_heartbeats (session_id, segment_index, rendered_at, buffer_health, player_state)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    session_id,
    segment_index,
    rendered_at || Date.now(),
    buffer_health || 0,
    player_state || "playing"
  );

  return NextResponse.json({ ok: true });
}
