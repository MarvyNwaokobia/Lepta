import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createAttestation } from "../attestor";

const HLS_OUTPUT_DIR = process.env.OWNCAST_HLS_DIR ?? "./owncast/data/hls";
const POLL_INTERVAL_MS = 1000;

let watcherInterval: ReturnType<typeof setInterval> | null = null;
let lastSegmentIndex = -1;
let activeStreamId: string | null = null;

export function startSegmentWatcher(streamId: string) {
  if (watcherInterval) stopSegmentWatcher();

  activeStreamId = streamId;
  lastSegmentIndex = -1;

  console.log(
    `[SegmentWatcher] Watching ${HLS_OUTPUT_DIR} for stream ${streamId}`
  );

  watcherInterval = setInterval(() => {
    try {
      if (!fs.existsSync(HLS_OUTPUT_DIR)) return;

      const files = fs
        .readdirSync(HLS_OUTPUT_DIR)
        .filter((f) => f.endsWith(".ts"))
        .sort();

      for (const file of files) {
        const match = file.match(/(\d+)\.ts$/);
        if (!match) continue;

        const segIndex = parseInt(match[1], 10);
        if (segIndex <= lastSegmentIndex) continue;

        const filePath = path.join(HLS_OUTPUT_DIR, file);
        const data = fs.readFileSync(filePath);

        createAttestation(streamId, segIndex, data);
        lastSegmentIndex = segIndex;

        console.log(
          `[SegmentWatcher] Attested segment ${segIndex} (${data.length} bytes, sha256: ${crypto.createHash("sha256").update(data).digest("hex").slice(0, 12)}...)`
        );
      }
    } catch (err) {
      console.error("[SegmentWatcher] Error:", err);
    }
  }, POLL_INTERVAL_MS);
}

export function stopSegmentWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
  activeStreamId = null;
  lastSegmentIndex = -1;
  console.log("[SegmentWatcher] Stopped");
}

export function getWatcherStatus() {
  return {
    active: watcherInterval !== null,
    streamId: activeStreamId,
    lastSegmentIndex,
    hlsDir: HLS_OUTPUT_DIR,
  };
}
