import type { EngagementSignal } from "./types";

const W1 = 0.6; // chat weight
const W2 = 0.4; // reaction weight
const ROLLING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

interface Event {
  timestamp: number;
  type: "chat" | "reaction";
}

export class EngagementTracker {
  private events: Event[] = [];

  addChat(timestamp: number = Date.now()) {
    this.events.push({ timestamp, type: "chat" });
    this.prune(timestamp);
  }

  addReaction(timestamp: number = Date.now()) {
    this.events.push({ timestamp, type: "reaction" });
    this.prune(timestamp);
  }

  compute(now: number = Date.now()): EngagementSignal {
    this.prune(now);

    const windowMinutes = ROLLING_WINDOW_MS / 60_000;
    const chatCount = this.events.filter((e) => e.type === "chat").length;
    const reactionCount = this.events.filter((e) => e.type === "reaction").length;

    const chatPerMin = chatCount / windowMinutes;
    const reactionDensity = reactionCount / windowMinutes;

    const normalizedChat = normalize(chatPerMin, 0, 30);
    const normalizedReaction = normalize(reactionDensity, 0, 20);

    const composite_score = W1 * normalizedChat + W2 * normalizedReaction;

    return {
      chat_messages_per_minute: chatPerMin,
      reaction_density: reactionDensity,
      composite_score: Math.min(1, Math.max(0, composite_score)),
    };
  }

  private prune(now: number) {
    const cutoff = now - ROLLING_WINDOW_MS;
    this.events = this.events.filter((e) => e.timestamp >= cutoff);
  }
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
