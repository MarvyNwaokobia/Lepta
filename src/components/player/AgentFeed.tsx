"use client";

import type { AgentDecision } from "@/lib/types";

interface AgentFeedProps {
  decisions: AgentDecision[];
}

export function AgentFeed({ decisions }: AgentFeedProps) {
  const decisionIcon = (d: AgentDecision["decision"]) => {
    switch (d) {
      case "continue":
        return "~";
      case "pause":
        return "||";
      case "topup":
        return "+";
    }
  };

  const decisionColor = (d: AgentDecision["decision"]) => {
    switch (d) {
      case "continue":
        return "text-[var(--meter-flowing)]";
      case "pause":
        return "text-[var(--meter-paused)]";
      case "topup":
        return "text-blue-400";
    }
  };

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Agent Reasoning
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {decisions.length === 0 && (
          <p className="text-xs text-zinc-600">
            Waiting for agent tick...
          </p>
        )}
        {decisions.map((d, i) => (
          <div
            key={`${d.tick_timestamp}-${i}`}
            className="flex gap-2 text-xs animate-tick"
          >
            <span
              className={`font-mono font-bold shrink-0 w-5 text-center ${decisionColor(d.decision)}`}
            >
              {decisionIcon(d.decision)}
            </span>
            <span className="text-zinc-400">
              {d.reasoning_text}
            </span>
            <span className="text-zinc-600 shrink-0 ml-auto font-mono">
              ${d.remaining_budget.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
