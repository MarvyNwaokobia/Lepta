import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import type { Stream } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { creator_id, title, rate_per_second } = body;

  if (!creator_id || !title || !rate_per_second) {
    return NextResponse.json(
      { error: "Missing required fields: creator_id, title, rate_per_second" },
      { status: 400 }
    );
  }

  const stream: Stream = {
    stream_id: uuidv4(),
    creator_id,
    title,
    rate_per_second: parseFloat(rate_per_second),
    status: "live",
    rtmp_key: crypto.randomBytes(16).toString("hex"),
    hls_playlist_url: "",
    started_at: Date.now(),
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO streams (stream_id, creator_id, title, rate_per_second, status, rtmp_key, hls_playlist_url, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    stream.stream_id,
    stream.creator_id,
    stream.title,
    stream.rate_per_second,
    stream.status,
    stream.rtmp_key,
    stream.hls_playlist_url,
    stream.started_at
  );

  return NextResponse.json(stream, { status: 201 });
}

export async function GET(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get("id");
  const db = getDb();

  if (streamId) {
    const stream = db
      .prepare("SELECT * FROM streams WHERE stream_id = ?")
      .get(streamId);
    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }
    return NextResponse.json(stream);
  }

  const streams = db
    .prepare("SELECT * FROM streams WHERE status = 'live' ORDER BY started_at DESC")
    .all();
  return NextResponse.json(streams);
}
