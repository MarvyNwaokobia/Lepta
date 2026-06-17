import crypto from "crypto";
import type { SegmentAttestation } from "./types";
import { getDb } from "./db";

export function createAttestation(
  streamId: string,
  segmentIndex: number,
  segmentData: Buffer
): SegmentAttestation {
  const attestation: SegmentAttestation = {
    stream_id: streamId,
    segment_index: segmentIndex,
    byte_size: segmentData.length,
    sha256: crypto.createHash("sha256").update(segmentData).digest("hex"),
    emitted_at: Date.now(),
  };

  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO segment_attestations
    (stream_id, segment_index, byte_size, sha256, emitted_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    attestation.stream_id,
    attestation.segment_index,
    attestation.byte_size,
    attestation.sha256,
    attestation.emitted_at
  );

  return attestation;
}

export function getLatestAttestation(
  streamId: string
): SegmentAttestation | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM segment_attestations
       WHERE stream_id = ?
       ORDER BY segment_index DESC LIMIT 1`
    )
    .get(streamId) as SegmentAttestation | undefined;

  return row ?? null;
}

export function getAttestationAt(
  streamId: string,
  segmentIndex: number
): SegmentAttestation | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM segment_attestations
       WHERE stream_id = ? AND segment_index = ?`
    )
    .get(streamId, segmentIndex) as SegmentAttestation | undefined;

  return row ?? null;
}
