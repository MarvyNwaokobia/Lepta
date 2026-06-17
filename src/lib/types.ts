export interface Stream {
  stream_id: string;
  creator_id: string;
  title: string;
  rate_per_second: number; // USDC
  status: "live" | "ended";
  rtmp_key: string;
  hls_playlist_url: string;
  started_at: number;
}

export interface SegmentAttestation {
  stream_id: string;
  segment_index: number;
  byte_size: number;
  sha256: string;
  emitted_at: number;
}

export interface ViewerSession {
  session_id: string;
  stream_id: string;
  viewer_wallet: string;
  rate_per_second: number;
  daily_cap_usdc: number;
  status: "active" | "paused" | "ended";
  started_at: number;
  last_segment_acked: number;
  network: "testnet" | "mainnet";
  total_accrued: number;
}

export interface ClientHeartbeat {
  session_id: string;
  segment_index: number;
  rendered_at: number;
  buffer_health: number;
  player_state: "playing" | "buffering" | "stalled" | "paused";
}

export interface MeterTick {
  session_id: string;
  second_timestamp: number;
  server_segment_at_t: number;
  client_segment_at_t: number;
  match: boolean;
  accrued_amount: number;
  reason_if_paused: string | null;
}

export interface SettlementBatch {
  batch_id: string;
  session_ids: string[];
  total_amount: number;
  gateway_tx_hash: string | null;
  settled_at: number;
}

export interface AgentDecision {
  session_id: string;
  tick_timestamp: number;
  remaining_budget: number;
  current_rate: number;
  engagement_signal: number;
  decision: "continue" | "pause" | "topup";
  reasoning_text: string;
}

export interface EngagementSignal {
  chat_messages_per_minute: number;
  reaction_density: number;
  composite_score: number;
}
