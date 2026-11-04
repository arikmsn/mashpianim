"use client";

import { FLOW_STEPS, flowNextAction, flowStepIndex, type FlowRole } from "@/lib/connection-flow";

interface ConnectionTimelineProps {
  status: string;
  role: FlowRole;
  initiatedBy?: string | null;
  deliveryType?: string | null;
  // Both sides hearted; the brand still has to confirm
  mutual?: boolean;
  // ISO date of the deadline that applies to the current step, if any
  deadline?: string | null;
  compact?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

// Five milestones with the current one highlighted, plus a one-line "what's next" for this side
export function ConnectionTimeline({ status, role, initiatedBy, deliveryType, mutual, deadline, compact = false }: ConnectionTimelineProps) {
  const reached = flowStepIndex(status);
  const closedEarly = status === "cancelled" || status === "rejected";
  const revision = status === "revision_requested";
  const next = flowNextAction(status, role, { initiatedBy, deliveryType, mutual });
  const steps = FLOW_STEPS.map((s) =>
    deliveryType === "digital" && s.key === "shipped" ? { ...s, label: "גישה" } : s
  );
  const currentIndex = status === "completed" ? -1 : reached + 1;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      <ol className="flex items-center" aria-label="שלבי החיבור">
        {steps.map((step, i) => {
          const done = !closedEarly && i <= reached;
          const current = !closedEarly && i === currentIndex;
          const circle = done
            ? "bg-emerald-500 text-white"
            : current
              ? revision
                ? "bg-amber-400 text-white ring-4 ring-amber-100"
                : "ig-gradient-bg text-white ring-4 ring-pink-100"
              : closedEarly
                ? "bg-neutral-100 text-neutral-300"
                : "bg-neutral-100 text-neutral-400";
          const size = compact ? "w-5 h-5 text-[10px]" : "w-7 h-7 text-xs";
          return (
            <li key={step.key} className="flex items-center flex-1 last:flex-none min-w-0">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <span className={`${size} rounded-full flex items-center justify-center font-bold transition-colors ${circle}`} aria-current={current ? "step" : undefined}>
                  {done ? "✓" : i + 1}
                </span>
                {!compact && (
                  <span className={`text-[10px] whitespace-nowrap ${done || current ? "text-neutral-700 font-medium" : "text-neutral-400"}`}>
                    {step.label}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <span className={`flex-1 h-0.5 mx-1 rounded-full ${!closedEarly && i < reached ? "bg-emerald-400" : "bg-neutral-100"}`} />
              )}
            </li>
          );
        })}
      </ol>
      {next.text && (
        <p className={`${compact ? "text-xs" : "text-sm"} ${next.mine ? "text-pink-600 font-medium" : "text-neutral-500"}`}>
          {next.mine ? "👉 " : ""}
          {next.text}
          {deadline && !closedEarly && status !== "completed" && (
            <span className="text-neutral-400 font-normal"> · עד {formatDate(deadline)}</span>
          )}
        </p>
      )}
    </div>
  );
}
