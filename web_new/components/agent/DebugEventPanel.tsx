import type { StreamEvent } from "@/lib/types/stream";

export function DebugEventPanel({ events }: { events: StreamEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted">原始流式事件会显示在这里。</p>;
  return (
    <div className="space-y-2">
      {events.slice().reverse().map((event, index) => (
        <pre key={`${event.type}-${index}`} className="overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(event, null, 2)}
        </pre>
      ))}
    </div>
  );
}
