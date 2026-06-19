import type { AgentDecision } from "./types";
import { getDb } from "./db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _model: any = null;

async function getModel() {
  if (!_model) {
    if (!process.env.ANTHROPIC_API_KEY) {
      return null;
    }
    const { ChatAnthropic } = await import("@langchain/anthropic");
    _model = new ChatAnthropic({
      model: "claude-haiku-4-5-20251001",
      temperature: 0.3,
      maxTokens: 200,
    });
  }
  return _model;
}

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

Respond ONLY with this JSON, no markdown, no extra text:
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

  const model = await getModel();

  if (model) {
    try {
      const response = await model.invoke([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ]);

      const text =
        typeof response.content === "string"
          ? response.content
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : (response.content as any[])
              .filter((b: { type: string }) => b.type === "text")
              .map((b: { text: string }) => b.text)
              .join("");

      // Strip markdown code fences if present
      const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      decision = parsed.decision;
      reasoning = parsed.reasoning;
    } catch (err) {
      console.error("[Agent] LLM call failed, using fallback:", err);
      ({ decision, reasoning } = ruleFallback(input));
    }
  } else {
    ({ decision, reasoning } = ruleFallback(input));
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

  try {
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
  } catch {
    // FK constraint fails for demo/test sessions — non-fatal
  }

  return agentDecision;
}

function ruleFallback(input: AgentInput): {
  decision: AgentDecision["decision"];
  reasoning: string;
} {
  const secondsRemaining = input.remaining_budget / input.current_rate;
  const engPct = Math.round(input.engagement_signal * 100);
  const watchMin = Math.round(input.elapsed_watch_seconds / 60);
  const spentPct = Math.round((input.total_spent / input.daily_cap) * 100);

  if (input.total_spent >= input.daily_cap) {
    return {
      decision: "pause",
      reasoning: `Daily cap of $${input.daily_cap.toFixed(2)} reached after ${watchMin}m of viewing. Pausing to protect budget.`,
    };
  }
  if (secondsRemaining < 15) {
    return {
      decision: "topup",
      reasoning: `Critical: only ${Math.round(secondsRemaining)}s of budget left (${spentPct}% spent). Engagement is ${engPct}% — worth topping up to continue.`,
    };
  }
  if (secondsRemaining < 60) {
    return {
      decision: "topup",
      reasoning: `Budget running low — ${Math.round(secondsRemaining)}s remaining at $${input.current_rate}/s. Consider adding funds to avoid interruption.`,
    };
  }
  if (input.engagement_signal < 0.08) {
    return {
      decision: "pause",
      reasoning: `Engagement dropped to ${engPct}% after ${watchMin}m — stream appears inactive. Pausing to preserve remaining $${input.remaining_budget.toFixed(4)}.`,
    };
  }
  if (input.engagement_signal < 0.2) {
    return {
      decision: "pause",
      reasoning: `Low engagement (${engPct}%) with ${spentPct}% of daily budget spent. Pausing — will resume if activity picks up.`,
    };
  }
  if (input.engagement_signal > 0.7) {
    return {
      decision: "continue",
      reasoning: `Strong engagement at ${engPct}%, ${Math.round(secondsRemaining / 60)}m of budget remaining. Good value — continuing.`,
    };
  }
  return {
    decision: "continue",
    reasoning: `Engagement steady at ${engPct}%, budget healthy with ${Math.round(secondsRemaining / 60)}m remaining. No action needed.`,
  };
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
