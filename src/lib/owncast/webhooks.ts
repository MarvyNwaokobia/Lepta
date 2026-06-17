import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";
import {
  startSegmentWatcher,
  stopSegmentWatcher,
} from "./segment-watcher";

export interface OwncastWebhookEvent {
  type: string;
  eventData: {
    id?: string;
    user?: {
      id: string;
      displayName: string;
    };
    clientId?: string;
    timestamp?: string;
    title?: string;
    streamTitle?: string;
    body?: string;
  };
}

export function handleWebhookEvent(event: OwncastWebhookEvent): {
  handled: boolean;
  action: string;
  details?: Record<string, unknown>;
} {
  switch (event.type) {
    case "STREAM_STARTED":
      return handleStreamStarted(event);
    case "STREAM_STOPPED":
      return handleStreamStopped(event);
    case "USER_JOINED":
      return handleUserJoined(event);
    case "USER_PARTED":
      return handleUserParted(event);
    case "CHAT":
      return handleChat(event);
    default:
      return { handled: false, action: "unknown_event" };
  }
}

function handleStreamStarted(event: OwncastWebhookEvent) {
  const db = getDb();
  const title =
    event.eventData.streamTitle ?? event.eventData.title ?? "Lepta Stream";

  const existing = db
    .prepare("SELECT stream_id FROM streams WHERE status = 'live' LIMIT 1")
    .get() as { stream_id: string } | undefined;

  if (existing) {
    startSegmentWatcher(existing.stream_id);
    return {
      handled: true,
      action: "stream_resumed",
      details: { stream_id: existing.stream_id },
    };
  }

  const streamId = uuidv4();
  db.prepare(`
    INSERT INTO streams (stream_id, creator_id, title, rate_per_second, status, rtmp_key, hls_playlist_url, started_at)
    VALUES (?, ?, ?, ?, 'live', '', '', ?)
  `).run(streamId, "owncast_creator", title, 0.001, Date.now());

  startSegmentWatcher(streamId);

  return {
    handled: true,
    action: "stream_started",
    details: { stream_id: streamId, title },
  };
}

function handleStreamStopped(_event: OwncastWebhookEvent) {
  const db = getDb();

  db.prepare("UPDATE streams SET status = 'ended' WHERE status = 'live'").run();
  db.prepare(
    "UPDATE viewer_sessions SET status = 'ended' WHERE status IN ('active', 'paused')"
  ).run();

  stopSegmentWatcher();

  return { handled: true, action: "stream_stopped" };
}

function handleUserJoined(event: OwncastWebhookEvent) {
  const db = getDb();
  const userId = event.eventData.user?.id ?? event.eventData.clientId ?? "anon";

  const stream = db
    .prepare("SELECT stream_id, rate_per_second FROM streams WHERE status = 'live' LIMIT 1")
    .get() as { stream_id: string; rate_per_second: number } | undefined;

  if (!stream) {
    return { handled: false, action: "no_active_stream" };
  }

  const existing = db
    .prepare(
      "SELECT session_id FROM viewer_sessions WHERE stream_id = ? AND viewer_wallet = ? AND status != 'ended'"
    )
    .get(stream.stream_id, userId);

  if (existing) {
    return {
      handled: true,
      action: "user_already_joined",
      details: { user: userId },
    };
  }

  const sessionId = uuidv4();
  db.prepare(`
    INSERT INTO viewer_sessions
    (session_id, stream_id, viewer_wallet, rate_per_second, daily_cap_usdc, status, started_at, last_segment_acked, network, total_accrued)
    VALUES (?, ?, ?, ?, 1.0, 'active', ?, -1, 'testnet', 0.0)
  `).run(sessionId, stream.stream_id, userId, stream.rate_per_second, Date.now());

  return {
    handled: true,
    action: "session_created",
    details: { session_id: sessionId, user: userId },
  };
}

function handleUserParted(event: OwncastWebhookEvent) {
  const db = getDb();
  const userId = event.eventData.user?.id ?? event.eventData.clientId ?? "anon";

  db.prepare(
    "UPDATE viewer_sessions SET status = 'ended' WHERE viewer_wallet = ? AND status != 'ended'"
  ).run(userId);

  return {
    handled: true,
    action: "session_ended",
    details: { user: userId },
  };
}

function handleChat(event: OwncastWebhookEvent) {
  return {
    handled: true,
    action: "chat_received",
    details: {
      user: event.eventData.user?.displayName ?? "anon",
      body: event.eventData.body,
    },
  };
}
