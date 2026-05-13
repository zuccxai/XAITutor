import type { StreamEvent } from "@/lib/types/stream";

type NormalizedSource = {
  title: string;
  detail: string;
  url?: string;
  meta?: string;
};

type RuntimeStep = {
  title: string;
  detail: string;
  tone: "running" | "done" | "error" | "info";
};

type SourcePanelProps = {
  events: StreamEvent[];
  ragEnabled?: boolean;
  knowledgeBases?: string[];
  waiting?: boolean;
};

function stringifySourceDetail(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function sourceTitle(value: Record<string, unknown>, fallback: string): string {
  return String(value.title || value.name || value.query || value.source || fallback);
}

function sourceDetail(value: Record<string, unknown>): string {
  return stringifySourceDetail(
    value.excerpt || value.content || value.text || value.metadata || value
  );
}

function sourceMeta(value: Record<string, unknown>): string {
  const parts = [
    value.kb_name ? `知识库：${String(value.kb_name)}` : "",
    value.page ? `页码：${String(value.page)}` : "",
    value.score !== undefined && value.score !== "" ? `相关度：${String(value.score)}` : ""
  ].filter(Boolean);
  return parts.join(" · ");
}

function isRagToolResult(event: StreamEvent): boolean {
  if (event.type !== "tool_result") return false;
  const metadata = event.metadata || {};
  const toolName = String(metadata.tool_name || metadata.tool || metadata.name || "").toLowerCase();
  return toolName === "rag" || toolName === "rag_search";
}

function isRagToolCall(event: StreamEvent): boolean {
  if (event.type !== "tool_call") return false;
  const metadata = event.metadata || {};
  const toolName = String(
    event.content || metadata.tool_name || metadata.tool || metadata.name || ""
  ).toLowerCase();
  return toolName === "rag" || toolName === "rag_search";
}

function splitRetrievedText(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function metadataSourcesHaveText(sources: unknown): boolean {
  if (!Array.isArray(sources)) return false;
  return sources.some((source) => {
    if (!source || typeof source !== "object") return false;
    const record = source as Record<string, unknown>;
    return Boolean(record.excerpt || record.content || record.text);
  });
}

function collectMetadataSources(
  event: StreamEvent,
  eventIndex: number,
  items: NormalizedSource[]
) {
  const metadataSources = event.metadata?.sources;
  if (!Array.isArray(metadataSources)) return;

  metadataSources.forEach((source, sourceIndex) => {
    if (source && typeof source === "object") {
      const record = source as Record<string, unknown>;
      items.push({
        title: sourceTitle(record, `来源 ${eventIndex + 1}.${sourceIndex + 1}`),
        detail: sourceDetail(record),
        url: typeof record.url === "string" ? record.url : undefined,
        meta: sourceMeta(record)
      });
      return;
    }

    items.push({
      title: `来源 ${eventIndex + 1}.${sourceIndex + 1}`,
      detail: stringifySourceDetail(source)
    });
  });
}

function collectSourcesEvent(event: StreamEvent, items: NormalizedSource[]) {
  if (event.type !== "sources") return;
  items.push({
    title: event.source || "知识库来源",
    detail: event.content || stringifySourceDetail(event.metadata || {})
  });
}

function collectRagToolResult(event: StreamEvent, eventIndex: number, items: NormalizedSource[]) {
  if (!isRagToolResult(event)) return;
  if (metadataSourcesHaveText(event.metadata?.sources)) return;

  const metadata = event.metadata || {};
  const chunks = splitRetrievedText(event.content || "");
  const kbName = typeof metadata.kb_name === "string" ? metadata.kb_name : "";
  const meta = kbName ? `知识库：${kbName}` : "";

  if (!chunks.length) {
    items.push({
      title: `已查询知识库 ${eventIndex + 1}`,
      detail: "本轮 RAG 已执行，但没有返回可展示的命中片段。",
      meta
    });
    return;
  }

  chunks.forEach((chunk, chunkIndex) => {
    items.push({
      title: chunks.length > 1 ? `命中片段 ${eventIndex + 1}.${chunkIndex + 1}` : "命中片段",
      detail: chunk,
      meta
    });
  });
}

function hasRagWithoutKbProgress(events: StreamEvent[]): boolean {
  return events.some((event) => event.metadata?.reason === "rag_without_kb");
}

function hasRagToolCall(events: StreamEvent[]): boolean {
  return events.some((event) => isRagToolCall(event));
}

function hasRagToolResult(events: StreamEvent[]): boolean {
  return events.some((event) => isRagToolResult(event));
}

function lastEventLabel(events: StreamEvent[]): string {
  const lastEvent = events[events.length - 1];
  if (!lastEvent) return "尚未收到事件";
  if (lastEvent.type === "tool_call" && isRagToolCall(lastEvent)) return "已请求知识库检索";
  if (lastEvent.type === "tool_result" && isRagToolResult(lastEvent)) return "已收到知识库检索结果";
  if (lastEvent.type === "content") return "正在生成回复";
  if (lastEvent.type === "done") return "本轮完成";
  if (lastEvent.type === "error") return "知识库来源";
  return `收到 ${lastEvent.type} 事件`;
}

function turnStatus(events: StreamEvent[], waiting: boolean): string {
  if (waiting && !events.length) return "等待后端响应";
  if (waiting) return lastEventLabel(events);
  if (!events.length) return "等待提问";
  return lastEventLabel(events);
}

const stageLabels: Record<string, string> = {
  recognition: "识别题目图片",
  retrieval: "检索知识库原题",
  matching: "判断是否命中原题",
  solving: "深度解题",
  writing: "整理答案"
};

function eventTitle(event: StreamEvent): string {
  if (event.type === "done") return "本轮已完成";
  if (event.type === "error") return "处理失败";
  if (event.type === "content") return "正在生成答案";
  if (event.type === "tool_call") return `调用工具：${event.content || "tool"}`;
  if (event.type === "tool_result") return "工具返回结果";
  if (event.stage) return stageLabels[event.stage] || event.stage;
  if (event.type === "session") return "会话已建立";
  return `收到 ${event.type} 事件`;
}

function eventDetail(event: StreamEvent): string {
  if (event.content?.trim()) return event.content.trim();
  const metadata = event.metadata || {};
  const reason = metadata.reason ? `原因：${String(metadata.reason)}` : "";
  const mode = metadata.mode ? `模式：${String(metadata.mode)}` : "";
  return [reason, mode].filter(Boolean).join(" · ");
}

function eventTone(event: StreamEvent, waiting: boolean): RuntimeStep["tone"] {
  if (event.type === "error") return "error";
  if (event.type === "done") return "done";
  if (waiting) return "running";
  return "info";
}

function collectRuntimeSteps(events: StreamEvent[], waiting: boolean): RuntimeStep[] {
  const visible = events.filter((event) =>
    ["progress", "tool_call", "tool_result", "result", "error", "done"].includes(event.type)
  );
  return visible.slice(-12).map((event) => ({
    title: eventTitle(event),
    detail: eventDetail(event),
    tone: eventTone(event, waiting)
  }));
}

function StepDot({ tone }: { tone: RuntimeStep["tone"] }) {
  const className =
    tone === "error"
      ? "bg-red-500"
      : tone === "done"
        ? "bg-emerald-500"
        : tone === "running"
          ? "bg-blue-500"
          : "bg-slate-300";
  return <span className={`mt-1.5 size-2 shrink-0 rounded-full ${className}`} />;
}

function RuntimeTimeline({
  events,
  waiting
}: {
  events: StreamEvent[];
  waiting: boolean;
}) {
  const steps = collectRuntimeSteps(events, waiting);
  if (!steps.length) {
    return (
      <div className="rounded-lg border border-borderline bg-white p-3">
        <div className="text-sm font-medium text-ink">{turnStatus(events, waiting)}</div>
        <div className="mt-2 text-sm leading-6 text-muted">
          {waiting ? "已提交请求，正在等待后端返回运行事件。" : "暂无运行事件。"}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-borderline bg-white p-3">
      <div className="text-sm font-medium text-ink">{turnStatus(events, waiting)}</div>
      <div className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <div key={`${step.title}-${index}`} className="flex gap-2">
            <StepDot tone={step.tone} />
            <div className="min-w-0">
              <div className="text-xs font-medium text-ink">{step.title}</div>
              {step.detail ? (
                <div
                  className={[
                    "mt-0.5 max-h-[60px] overflow-hidden break-words",
                    "text-xs leading-5 text-muted"
                  ].join(" ")}
                >
                  {step.detail}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 生成知识库来源的空状态提示。
 *
 * 输入：
 *   events: 当前轮次收到的流式事件。
 *   ragEnabled: 当前 RAG 工具是否启用。
 *   knowledgeBases: 当前选择的知识库名称列表。
 * 输出：
 *   返回面向用户的空状态原因说明。
 */
function emptySourceHint(
  events: StreamEvent[],
  ragEnabled: boolean,
  knowledgeBases: string[],
  waiting: boolean
): string {
  if (!ragEnabled) return "RAG 未启用。请打开上方 RAG 工具开关后再提问。";
  if (!knowledgeBases.length) return "RAG 已启用，但当前没有选择知识库。";
  if (hasRagWithoutKbProgress(events)) return "RAG 已启用，但本轮后端没有收到可用知识库。";
  if (hasRagToolCall(events) && !hasRagToolResult(events)) {
    return "已请求知识库检索，但尚未收到检索结果。";
  }
  if (waiting && !hasRagToolCall(events)) return "等待模型判断本轮是否需要调用知识库检索。";
  return `RAG 已启用，当前知识库：${knowledgeBases.join(", ")}。本轮模型未触发知识库检索。`;
}

/**
 * 汇总流式事件中的知识库来源。
 *
 * 输入：
 *   events: 当前轮次收到的流式事件。
 * 输出：
 *   返回可直接展示的来源条目；当后端没有结构化来源时，会从 RAG tool_result 中提取命中文本。
 */
function collectSources(events: StreamEvent[]): NormalizedSource[] {
  const items: NormalizedSource[] = [];

  events.forEach((event, index) => {
    collectMetadataSources(event, index, items);
    collectSourcesEvent(event, items);
    collectRagToolResult(event, index, items);
  });

  return items.filter((item) => item.detail.trim().length > 0 || item.url);
}

/**
 * 渲染知识库来源列表。
 *
 * 输入：
 *   events: 当前轮次收到的流式事件。
 * 输出：
 *   返回知识库引用、检索片段或空状态。
 */
export function SourcePanel({
  events,
  ragEnabled = false,
  knowledgeBases = [],
  waiting = false
}: SourcePanelProps) {
  const sources = collectSources(events);
  if (!sources.length) {
    return (
      <div className="space-y-3">
        <RuntimeTimeline events={events} waiting={waiting} />
        <div className="rounded-lg border border-borderline bg-white p-3">
          <div className="text-sm font-medium text-ink">知识库来源</div>
          <div className="mt-2 text-sm leading-6 text-muted">
            {emptySourceHint(events, ragEnabled, knowledgeBases, waiting)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <RuntimeTimeline events={events} waiting={waiting} />
      <div className="rounded-lg border border-borderline bg-white p-3">
        <div className="text-sm font-medium text-ink">知识库来源</div>
        <div className="mt-1 text-xs text-muted">已整理 {sources.length} 条知识库来源</div>
      </div>
      {sources.map((source, index) => (
        <div key={`source-${index}`} className="rounded-lg border border-borderline bg-white p-3">
          <div className="text-sm font-medium text-ink">{source.title}</div>
          {source.meta ? <div className="mt-1 text-xs text-muted">{source.meta}</div> : null}
          {source.url ? (
            <div className="mt-1 break-all text-xs text-accent">{source.url}</div>
          ) : null}
          {source.detail ? (
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted">
              {source.detail}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}
