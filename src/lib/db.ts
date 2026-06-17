import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "lepta.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS streams (
      stream_id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      rate_per_second REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'live',
      rtmp_key TEXT NOT NULL,
      hls_playlist_url TEXT NOT NULL DEFAULT '',
      started_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segment_attestations (
      stream_id TEXT NOT NULL,
      segment_index INTEGER NOT NULL,
      byte_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      emitted_at INTEGER NOT NULL,
      PRIMARY KEY (stream_id, segment_index),
      FOREIGN KEY (stream_id) REFERENCES streams(stream_id)
    );

    CREATE TABLE IF NOT EXISTS viewer_sessions (
      session_id TEXT PRIMARY KEY,
      stream_id TEXT NOT NULL,
      viewer_wallet TEXT NOT NULL,
      rate_per_second REAL NOT NULL,
      daily_cap_usdc REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'active',
      started_at INTEGER NOT NULL,
      last_segment_acked INTEGER NOT NULL DEFAULT -1,
      network TEXT NOT NULL DEFAULT 'testnet',
      total_accrued REAL NOT NULL DEFAULT 0.0,
      FOREIGN KEY (stream_id) REFERENCES streams(stream_id)
    );

    CREATE TABLE IF NOT EXISTS client_heartbeats (
      session_id TEXT NOT NULL,
      segment_index INTEGER NOT NULL,
      rendered_at INTEGER NOT NULL,
      buffer_health REAL NOT NULL,
      player_state TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES viewer_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS meter_ticks (
      session_id TEXT NOT NULL,
      second_timestamp INTEGER NOT NULL,
      server_segment_at_t INTEGER NOT NULL,
      client_segment_at_t INTEGER NOT NULL,
      match INTEGER NOT NULL,
      accrued_amount REAL NOT NULL DEFAULT 0.0,
      reason_if_paused TEXT,
      PRIMARY KEY (session_id, second_timestamp),
      FOREIGN KEY (session_id) REFERENCES viewer_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS settlement_batches (
      batch_id TEXT PRIMARY KEY,
      session_ids TEXT NOT NULL,
      total_amount REAL NOT NULL,
      gateway_tx_hash TEXT,
      settled_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_decisions (
      session_id TEXT NOT NULL,
      tick_timestamp INTEGER NOT NULL,
      remaining_budget REAL NOT NULL,
      current_rate REAL NOT NULL,
      engagement_signal REAL NOT NULL,
      decision TEXT NOT NULL,
      reasoning_text TEXT NOT NULL,
      PRIMARY KEY (session_id, tick_timestamp),
      FOREIGN KEY (session_id) REFERENCES viewer_sessions(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_heartbeats_session
      ON client_heartbeats(session_id, rendered_at);
    CREATE INDEX IF NOT EXISTS idx_attestations_stream
      ON segment_attestations(stream_id, segment_index);
  `);
}
