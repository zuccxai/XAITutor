"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, Server } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  embeddingDiagnosticsEventsUrl,
  getSystemStatus,
  startEmbeddingDiagnostics
} from "@/lib/api/system";
import type { SystemStatus } from "@/lib/types/knowledge";

export function SettingsWorkspace() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [embeddingLog, setEmbeddingLog] = useState<string>("");
  const [testingEmbedding, setTestingEmbedding] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  async function refresh() {
    setError(null);
    try {
      setStatus(await getSystemStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载系统状态失败");
    }
  }

  async function testEmbedding() {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setError(null);
    setEmbeddingLog("正在准备 Embedding 诊断...\n");
    setTestingEmbedding(true);
    try {
      const payload = await startEmbeddingDiagnostics();
      if (!payload.run_id) {
        throw new Error(payload.detail || "无法启动 Embedding 诊断");
      }
      const source = new EventSource(embeddingDiagnosticsEventsUrl(payload.run_id));
      eventSourceRef.current = source;
      source.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data) as {
            type?: string;
            message?: string;
            error?: string;
          };
          const line = entry.message || entry.error || event.data;
          setEmbeddingLog((current) => `${current}${line}\n`);
          if (entry.type === "done" || entry.type === "complete" || entry.type === "error") {
            setTestingEmbedding(false);
            source.close();
            eventSourceRef.current = null;
            void refresh();
          }
        } catch {
          setEmbeddingLog((current) => `${current}${event.data}\n`);
        }
      };
      source.onerror = () => {
        setTestingEmbedding(false);
        source.close();
        eventSourceRef.current = null;
      };
    } catch (err) {
      setTestingEmbedding(false);
      setError(err instanceof Error ? err.message : "Embedding 测试失败");
    }
  }

  useEffect(() => {
    void refresh();
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <AppShell title="系统设置" subtitle="检查 LLM、Embedding 和搜索服务的运行状态">
      <div className="h-full overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">运行诊断</h2>
            <p className="text-sm text-muted">
              此页面只读取现有后端配置，不会修改配置。
            </p>
          </div>
          <Button onClick={() => void refresh()}>
            <RefreshCw size={15} />
            刷新
          </Button>
        </div>
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="LLM" icon={<Server size={17} />} data={status?.llm} />
          <Panel title="Embedding" icon={<Activity size={17} />} data={status?.embeddings}>
            <Button
              className="mt-3 w-full"
              onClick={() => void testEmbedding()}
              disabled={testingEmbedding}
            >
              {testingEmbedding ? "测试中..." : "测试 Embedding"}
            </Button>
            {embeddingLog ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
                {embeddingLog}
              </pre>
            ) : null}
          </Panel>
          <Panel title="搜索" icon={<Server size={17} />} data={status?.search} />
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Embedding dimensions 说明</div>
          <p className="mt-1">
            本地 vLLM 的 Qwen3-Embedding 建议在后端环境中设置{" "}
            <code>EMBEDDING_SEND_DIMENSIONS=false</code>，让请求不要携带
            OpenAI 风格的 <code>dimensions</code> 参数。
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Panel({
  title,
  icon,
  data,
  children
}: {
  title: string;
  icon: React.ReactNode;
  data?: Record<string, unknown>;
  children?: React.ReactNode;
}) {
  const status = String(data?.status || "unknown");
  return (
    <section className="rounded-md border border-borderline bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </div>
        <Badge tone={status === "configured" || status === "ok" ? "success" : "neutral"}>
          {status}
        </Badge>
      </div>
      <dl className="space-y-2 text-sm">
        {Object.entries(data || {}).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4">
            <dt className="text-muted">{key}</dt>
            <dd className="truncate text-right">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}
