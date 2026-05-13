import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { SystemStatus } from "@/lib/types/knowledge";

function readString(record: Record<string, unknown> | undefined, key: string): string {
  const value = record?.[key];
  return value == null ? "" : String(value);
}

export function EmbeddingStatusPanel({ status }: { status?: SystemStatus }) {
  const embedding = status?.embeddings;
  const ok = readString(embedding, "status") === "configured" || readString(embedding, "status") === "ok";
  return (
    <section className="rounded-md border border-borderline bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          {ok ? <CheckCircle2 size={17} className="text-emerald-600" /> : <AlertTriangle size={17} className="text-warning" />}
          Embedding 配置
        </div>
        <Badge tone={ok ? "success" : "warning"}>{readString(embedding, "status") || "unknown"}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-muted">模型</dt>
        <dd className="truncate text-right">{readString(embedding, "model") || "未设置"}</dd>
        <dt className="text-muted">发送 dimensions</dt>
        <dd className="text-right">检查 .env / catalog</dd>
      </dl>
      <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
        本地 Qwen3/vLLM 部署通常应保持 <code>EMBEDDING_SEND_DIMENSIONS=false</code>，除非供应商明确支持自定义维度。
      </p>
    </section>
  );
}
