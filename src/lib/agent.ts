import { ChatAnthropic } from "@langchain/anthropic";
import type { AgentDecision } from "./types";
import { getDb } from "./db";

const model = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  temperature: 0.3,
  maxTokens: 200,
});

const SYSTEM_PROMPT = `You are a viewer budget agent for Lepta, a pay-per-second livestream platform.
You manage a viewer's spending on a live stream. Each tick you receive the viewer's remaining budget,
the current per-second rate, their daily spending cap, an engagement score (0-1), and elapsed watch time.

You must decide: "continue" (keep paying), "pause" (stop paying, viewer stays but meter stops),
or "topup" (request more funds from viewer's wallet).

Rules:
- If remaining budget < 30 seconds of viewing at current rate, recommend "topup" or "pause"
- If engagement score drops below 0.15 for sustained periods, suggest "pause" to save budget
- Never exceed the daily cap
- Be concise in reasoning (1-2 sentences max)

Respond in exactly this JSON format:
{"decision": "continue|pause|topup", "reasoning": "brief explanation"}`;

export interface AgentInput {
  remaining_budget: number;
  current_rate: number;
  daily_cap: number;
  engagement_signal: number;
  elapsed_watch_seconds: number;
  total_spent: number;
}

export async function runAgentTick(
  sessionId: string,
  input: AgentInput
): Promise<AgentDecision> {
  const now = Date.now();

  const userMessage = `Current state:
- Remaining budget: $${input.remaining_budget.toFixed(6)} USDC
- Per-second rate: $${input.current_rate.toFixed(6)}/s
- Daily cap: $${input.daily_cap.toFixed(4)} USDC
- Total spent today: $${input.total_spent.toFixed(6)} USDC
- Engagement score: ${input.engagement_signal.toFixed(3)} (0=dead, 1=peak)
- Watch time: ${Math.round(input.elapsed_watch_seconds)}s

What should we do?`;

  let decision: AgentDecision["decision"] = "continue";
  let reasoning = "";

  try {
    const response = await model.invoke([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : response.content
            .filter((b): b is { type: "text"; text: string } => "text" in b)
            .map((b) => b.text)
            .join("");

    const parsed = JSON.parse(text);
    decision = parsed.decision;
    reasoning = parsed.reasoning;
  } catch {
    // Fallback: rule-based if LLM fails
    const secondsRemaining = input.remaining_budget / input.current_rate;
    if (input.total_spent >= input.daily_cap) {
      decision = "pause";
      reasoning = "Daily cap reached.";
    } else if (secondsRemaining < 30) {
      decision = "topup";
      reasoning = `Only ${Math.round(secondsRemaining)}s of budget remaining.`;
    } else if (input.engagement_signal < 0.1) {
      decision = "pause";
      reasoning = "Engagement too low to justify spend.";
    } else {
      decision = "continue";
      reasoning = "Budget healthy, engagement acceptable.";
    }
  }

  const agentDecision: AgentDecision = {
    session_id: sessionId,
    tick_timestamp: now,
    remaining_budget: input.remaining_budget,
    current_rate: input.current_rate,
    engagement_signal: input.engagement_signal,
    decision,
    reasoning_text: reasoning,
  };

  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO agent_decisions
    (session_id, tick_timestamp, remaining_budget, current_rate, engagement_signal, decision, reasoning_text)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    agentDecision.session_id,
    agentDecision.tick_timestamp,
    agentDecision.remaining_budget,
    agentDecision.current_rate,
    agentDecision.engagement_signal,
    agentDecision.decision,
    agentDecision.reasoning_text
  );

  return agentDecision;
}

export function getRecentDecisions(
  sessionId: string,
  limit: number = 10
): AgentDecision[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM agent_decisions
       WHERE session_id = ?
       ORDER BY tick_timestamp DESC LIMIT ?`
    )
    .all(sessionId, limit) as AgentDecision[];
}
