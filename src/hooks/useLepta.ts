"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { AgentDecision, MeterTick } from "@/lib/types";

interface MeterState {
  status: "flowing" | "paused" | "stopped";
  totalAccrued: number;
  ratePerSecond: number;
  match: boolean;
  reason: string | null;
}

interface UseLeptaOptions {
  streamId: string;
  sessionId: string | null;
  dailyCap: number;
  ratePerSecond: number;
}

export function useLepta({
  streamId,
  sessionId,
  dailyCap,
  ratePerSecond,
}: UseLeptaOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [meter, setMeter] = useState<MeterState>({
    status: "paused",
    totalAccrued: 0,
    ratePerSecond,
    match: false,
    reason: null,
  });
  const [agentDecisions, setAgentDecisions] = useState<AgentDecision[]>([]);
  const [settlements, setSettlements] = useState<
    { batch_id: string; total_amount: number; gateway_tx_hash: string | null }[]
  >([]);

  useEffect(() => {
    const socket = io({
      path: "/api/ws",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
      if (streamId && sessionId) {
        socket.emit("join_stream", { streamId, sessionId });
      }
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("meter_tick", (tick: MeterTick & { total_accrued: number; status: string }) => {
      setMeter((prev) => ({
        ...prev,
        totalAccrued: tick.total_accrued,
        match: tick.match,
        reason: tick.reason_if_paused,
        status:
          tick.total_accrued >= dailyCap
            ? "stopped"
            : tick.status === "active"
              ? "flowing"
              : "paused",
      }));
    });

    socket.on("agent_decision", (decision: AgentDecision) => {
      setAgentDecisions((prev) => [decision, ...prev].slice(0, 20));
      if (decision.decision === "pause") {
        setMeter((prev) => ({ ...prev, status: "paused" }));
      }
    });

    socket.on(
      "settlement",
      (data: { batch_id: string; total_amount: number; gateway_tx_hash: string | null }) => {
        setSettlements((prev) => [data, ...prev].slice(0, 10));
      }
    );

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [streamId, sessionId, dailyCap]);

  useEffect(() => {
    if (socketRef.current?.connected && streamId && sessionId) {
      socketRef.current.emit("join_stream", { streamId, sessionId });
    }
  }, [streamId, sessionId]);

  const sendHeartbeat = useCallback(
    (segmentIndex: number, bufferHealth: number, playerState: string) => {
      if (!socketRef.current || !sessionId) return;
      socketRef.current.emit("heartbeat", {
        sessionId,
        segmentIndex,
        bufferHealth,
        playerState,
      });
    },
    [sessionId]
  );

  const sendChat = useCallback(
    (message: string) => {
      if (!socketRef.current) return;
      socketRef.current.emit("chat", { streamId, message });
    },
    [streamId]
  );

  const sendReaction = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit("reaction", { streamId });
  }, [streamId]);

  return {
    connected,
    meter,
    agentDecisions,
    settlements,
    sendHeartbeat,
    sendChat,
    sendReaction,
  };
}
