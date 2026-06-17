"use client";

import { useEffect, useRef, useCallback } from "react";

interface StreamPlayerProps {
  hlsUrl: string;
  sessionId: string;
  onSegmentRendered?: (segmentIndex: number, url: string) => void;
  onPlayerState?: (state: "playing" | "buffering" | "stalled" | "paused") => void;
  onBufferHealth?: (seconds: number) => void;
}

export function StreamPlayer({
  hlsUrl,
  sessionId,
  onSegmentRendered,
  onPlayerState,
  onBufferHealth,
}: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentCountRef = useRef(0);
  const heartbeatBatchRef = useRef<{
    segments: number[];
    states: string[];
  }>({ segments: [], states: [] });

  const flushHeartbeat = useCallback(
    async (segmentIndex: number, playerState: string, bufferHealth: number) => {
      if (!sessionId) return;
      try {
        await fetch("/api/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            segment_index: segmentIndex,
            rendered_at: Date.now(),
            buffer_health: bufferHealth,
            player_state: playerState,
          }),
        });
      } catch {
        // non-fatal
      }
    },
    [sessionId]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hls: any = null;

    async function initPlayer() {
      const HlsModule = await import("hls.js");
      const Hls = HlsModule.default;

      if (!Hls.isSupported()) {
        if (video!.canPlayType("application/vnd.apple.mpegurl")) {
          video!.src = hlsUrl;
          return;
        }
        console.error("HLS not supported");
        return;
      }

      hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 10,
        liveSyncDuration: 3,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video!);

      hls.on(
        Hls.Events.FRAG_LOADED,
        (_e: unknown, data: { frag: { sn: number; url: string } }) => {
          const sn =
            typeof data.frag.sn === "number" ? data.frag.sn : segmentCountRef.current + 1;
          segmentCountRef.current = sn;
          heartbeatBatchRef.current.segments.push(sn);
          onSegmentRendered?.(sn, data.frag.url);
        }
      );

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        const buffered = video!.buffered;
        if (buffered.length > 0) {
          const health = buffered.end(buffered.length - 1) - video!.currentTime;
          onBufferHealth?.(health);
        }
      });

      hls.on(
        Hls.Events.ERROR,
        (_event: unknown, data: { fatal: boolean; type: string; details: string }) => {
          if (data.fatal) {
            onPlayerState?.("stalled");
            if (data.type === "networkError") {
              setTimeout(() => hls?.startLoad(), 3000);
            }
          }
        }
      );

      hls.on(Hls.Events.ERROR, (_e2: unknown, d2: { details: string }) => {
        if (d2.details === "bufferStalledError") {
          onPlayerState?.("stalled");
          heartbeatBatchRef.current.states.push("stalled");
        }
      });

      hlsRef.current = hls;
    }

    initPlayer();

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl, onSegmentRendered, onPlayerState, onBufferHealth]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => onPlayerState?.("playing");
    const handlePause = () => onPlayerState?.("paused");
    const handleWaiting = () => onPlayerState?.("buffering");
    const handleStalled = () => onPlayerState?.("stalled");

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("stalled", handleStalled);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("stalled", handleStalled);
    };
  }, [onPlayerState]);

  useEffect(() => {
    heartbeatRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const bufferHealth =
        video.buffered.length > 0
          ? video.buffered.end(video.buffered.length - 1) - video.currentTime
          : 0;

      const state = video.paused
        ? "paused"
        : bufferHealth < 0.5
          ? "buffering"
          : "playing";

      flushHeartbeat(segmentCountRef.current, state, bufferHealth);
    }, 3000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [flushHeartbeat]);

  return (
    <div className="rounded-xl overflow-hidden border border-card-border bg-black aspect-video relative">
      <video
        ref={videoRef}
        className="w-full h-full"
        autoPlay
        playsInline
        muted
        controls
      />
      {!hlsUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
          Waiting for stream...
        </div>
      )}
    </div>
  );
}
