import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { StreamEvent } from "@/lib/types/stream";

export function StageTimeline({ events }: { events: StreamEvent[] }) {
  const stageEvents = events.filter((event) => event.type === "stage_start" || event.type === "stage_end");
  if (!stageEvents.length) {
    return <p className="text-sm text-muted">暂无阶段事件。</p>;
  }
  return (
    <div className="space-y-3">
      {stageEvents.map((event, index) => {
        const done = event.type === "stage_end";
        const Icon = done ? CheckCircle2 : event.type === "stage_start" ? Loader2 : Circle;
        return (
          <div key={`${event.type}-${event.stage}-${index}`} className="flex gap-3">
            <Icon size={17} className={done ? "text-emerald-600" : "text-accent"} />
            <div>
              <div className="text-sm font-medium">{event.stage || "阶段"}</div>
              <div className="text-xs text-muted">{event.source || "智能体"} · {event.type}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
