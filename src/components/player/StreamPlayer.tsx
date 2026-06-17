"use client";

import { useEffect, useRef, useCallback } from "react";

interface StreamPlayerProps {
  hlsUrl: string;
  sessionId: string;
  onSegmentRendered?: (segmentIndex: number) => void;
  onPlayerState?: (state: "playing" | "buffering" | "stalled" | "paused") => void;
}

export function StreamPlayer({
  hlsUrl,
  sessionId,
  onSegmentRendered,
  onPlayerState,
}: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentCountRef = useRef(0);

  const sendHeartbeat = useCallback(
    async (segmentIndex: number, playerState: string, bufferHealth: number) => {
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
        // Heartbeat failure is non-fatal
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
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video!);

      hls.on(Hls.Events.FRAG_LOADED, () => {
        segmentCountRef.current++;
        onSegmentRendered?.(segmentCountRef.current);
      });

      hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal: boolean; type: string }) => {
        if (data.fatal) {
          onPlayerState?.("stalled");
        }
      });

      hlsRef.current = hls;
    }

    initPlayer();

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl, onSegmentRendered, onPlayerState]);

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

  // Batched heartbeat every 3 seconds
  useEffect(() => {
    heartbeatRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const bufferHealth = video.buffered.length > 0
        ? video.buffered.end(video.buffered.length - 1) - video.currentTime
        : 0;

      const state = video.paused
        ? "paused"
        : bufferHealth < 0.5
          ? "buffering"
          : "playing";

      sendHeartbeat(segmentCountRef.current, state, bufferHealth);
    }, 3000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [sendHeartbeat]);

  return (
    <div className="rounded-xl overflow-hidden border border-card-border bg-black aspect-video">
      <video
        ref={videoRef}
        className="w-full h-full"
        autoPlay
        playsInline
        muted
        controls
      />
    </div>
  );
}
