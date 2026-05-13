"use client";

import { Code2, FileSearch, Globe2, Lightbulb, Search, Sparkles } from "lucide-react";
import type { CapabilityName, ToolName } from "@/lib/types/chat";
import { allowedToolsForCapability } from "@/lib/capabilities";
import { cn } from "@/lib/cn";

const tools: { id: ToolName; label: string; icon: typeof Search }[] = [
  { id: "rag", label: "RAG", icon: FileSearch },
  { id: "web_search", label: "联网", icon: Globe2 },
  { id: "code_execution", label: "代码", icon: Code2 },
  { id: "paper_search", label: "论文", icon: Search },
  { id: "reason", label: "推理", icon: Sparkles },
  { id: "brainstorm", label: "发散", icon: Lightbulb }
];

/**
 * 渲染当前能力允许使用的工具开关。
 *
 * 输入：
 *   capability: 当前能力，用于过滤允许展示的工具。
 *   selected: 当前已启用工具列表。
 *   onToggle: 工具切换回调。
 * 输出：
 *   返回工具按钮列表。
 */
export function ToolToggles({
  capability,
  selected,
  onToggle
}: {
  capability: CapabilityName;
  selected: ToolName[];
  onToggle: (tool: ToolName) => void;
}) {
  const allowedTools = allowedToolsForCapability(capability);
  const visibleTools = tools.filter((tool) => allowedTools.includes(tool.id));

  return (
    <div className="flex flex-wrap gap-2">
      {visibleTools.map((tool) => {
        const Icon = tool.icon;
        const active = selected.includes(tool.id);
        return (
          <button
            key={tool.id}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs",
              active ? "border-blue-200 bg-blue-50 text-accent" : "border-borderline bg-white text-muted"
            )}
            onClick={() => onToggle(tool.id)}
          >
            <Icon size={14} />
            {tool.label}
          </button>
        );
      })}
    </div>
  );
}
