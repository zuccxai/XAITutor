import type { StreamEvent } from "@/lib/types/stream";
import { Badge } from "@/components/ui/Badge";

export function ToolCallPanel({ events }: { events: StreamEvent[] }) {
  const toolEvents = events.filter((event) => event.type === "tool_call" || event.type === "tool_result");
  if (!toolEvents.length) return <p className="text-sm text-muted">暂无工具调用。</p>;
  return (
    <div className="space-y-3">
      {toolEvents.map((event, index) => (
        <div key={`${event.type}-${index}`} className="rounded-md border border-borderline bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">{event.source || "工具"}</span>
            <Badge tone={event.type === "tool_result" ? "success" : "info"}>{event.type}</Badge>
          </div>
          <p className="whitespace-pre-wrap text-xs text-muted">{event.content || JSON.stringify(event.metadata || {}, null, 2)}</p>
        </div>
      ))}
    </div>
  );
}
