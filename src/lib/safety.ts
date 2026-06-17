import { getDb } from "./db";

const MAX_SESSIONS_PER_WALLET_PER_STREAM = 3;
const MAX_ACTIVE_SESSIONS_PER_STREAM = 100;
const MIN_CAP_USDC = 0.01;
const MAX_CAP_USDC = 100;
const MIN_RATE = 0.000001;
const MAX_RATE = 1.0;
const SESSION_COOLDOWN_MS = 5000;

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkSessionCreation(
  streamId: string,
  viewerWallet: string
): SafetyCheckResult {
  const db = getDb();

  const existingSessions = db
    .prepare(
      `SELECT COUNT(*) as count FROM viewer_sessions
       WHERE stream_id = ? AND viewer_wallet = ? AND status != 'ended'`
    )
    .get(streamId, viewerWallet) as { count: number };

  if (existingSessions.count >= MAX_SESSIONS_PER_WALLET_PER_STREAM) {
    return {
      allowed: false,
      reason: `Max ${MAX_SESSIONS_PER_WALLET_PER_STREAM} active sessions per wallet per stream`,
    };
  }

  const recentSession = db
    .prepare(
      `SELECT started_at FROM viewer_sessions
       WHERE viewer_wallet = ? ORDER BY started_at DESC LIMIT 1`
    )
    .get(viewerWallet) as { started_at: number } | undefined;

  if (recentSession && Date.now() - recentSession.started_at < SESSION_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: `Please wait ${Math.ceil((SESSION_COOLDOWN_MS - (Date.now() - recentSession.started_at)) / 1000)}s before creating another session`,
    };
  }

  const activeSessions = db
    .prepare(
      `SELECT COUNT(*) as count FROM viewer_sessions
       WHERE stream_id = ? AND status != 'ended'`
    )
    .get(streamId) as { count: number };

  if (activeSessions.count >= MAX_ACTIVE_SESSIONS_PER_STREAM) {
    return {
      allowed: false,
      reason: "Stream has reached maximum viewer capacity",
    };
  }

  return { allowed: true };
}

export function sanitizeCap(cap: number): number {
  return Math.min(MAX_CAP_USDC, Math.max(MIN_CAP_USDC, cap));
}

export function sanitizeRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

export function validateRate(rate: number): SafetyCheckResult {
  if (rate < MIN_RATE) {
    return { allowed: false, reason: `Rate must be at least $${MIN_RATE}/s` };
  }
  if (rate > MAX_RATE) {
    return { allowed: false, reason: `Rate cannot exceed $${MAX_RATE}/s` };
  }
  return { allowed: true };
}
