"use client";

import { Activity } from "lucide-react";
import type { StreamEvent } from "@/lib/types/stream";
import { SourcePanel } from "@/components/agent/SourcePanel";
import { cn } from "@/lib/cn";

type RightInspectorProps = {
  events: StreamEvent[];
  ragEnabled?: boolean;
  knowledgeBases?: string[];
  waiting?: boolean;
};

/**
 * 渲染右侧运行过程和知识库来源面板。
 *
 * 输入：
 *   events: 当前轮次收到的流式事件。
 *   ragEnabled: 当前 RAG 工具是否启用。
 *   knowledgeBases: 当前选择的知识库名称列表。
 *   waiting: 当前是否仍在等待助手返回。
 * 输出：
 *   返回展示后台运行事件和知识库来源的右侧观察区域。
 */
export function RightInspector({
  events,
  ragEnabled = false,
  knowledgeBases = [],
  waiting = false
}: RightInspectorProps) {
  return (
    <aside
      className="hidden w-[340px] shrink-0 flex-col border-l border-borderline bg-white lg:flex"
    >
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b border-borderline px-5",
          "text-sm font-semibold"
        )}
      >
        <Activity size={16} className="text-accent" />
        运行过程
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4 scrollbar-thin">
        <SourcePanel
          events={events}
          ragEnabled={ragEnabled}
          knowledgeBases={knowledgeBases}
          waiting={waiting}
        />
      </div>
    </aside>
  );
}
