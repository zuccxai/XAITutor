"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RightInspector } from "@/components/layout/RightInspector";
import { CapabilitySelector } from "@/components/chat/CapabilitySelector";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { useUnifiedChat } from "@/hooks/useUnifiedChat";
import { useKnowledgeBases } from "@/hooks/useKnowledgeBases";
import { cn } from "@/lib/cn";
import type { CapabilityName } from "@/lib/types/chat";

const workspaceTitles: Record<CapabilityName, string> = {
  chat: "学习",
  deep_solve: "深度解题",
  deep_question: "出题实验室",
  deep_guided: "深度引导",
  photo_solve: "拍照解题",
  competition_consulting: "备赛助手"
};

/**
 * 获取默认知识库名称。
 *
 * 输入：
 *   items: 后端返回的知识库列表。
 * 输出：
 *   返回默认知识库名称；没有默认项时返回第一个知识库；没有知识库时返回空字符串。
 */
function defaultKnowledgeBaseName(
  items: { name: string; is_default?: boolean }[]
): string {
  return items.find((item) => item.is_default)?.name || items[0]?.name || "";
}

/**
 * 获取工作区顶部功能描述。
 *
 * 输入：
 *   capability: 当前正在使用的能力。
 *   shellTitle: 页面级标题；日常练习会传入该值。
 * 输出：
 *   返回展示在顶部标题下方的简短功能说明。
 */
function workspaceSubtitle(
  capability: CapabilityName,
  shellTitle?: string
): string {
  if (shellTitle === "日常练习") {
    return "围绕题目讲解和思路引导，支持知识库辅助学习。";
  }
  if (capability === "deep_guided") {
    return "通过追问和提示引导你逐步理解问题。";
  }
  if (capability === "deep_solve") {
    return "结合知识库和推理能力拆解题目。";
  }
  if (capability === "photo_solve") {
    return "上传题目图片，优先匹配知识库原题，未命中时进入深度解题。";
  }
  if (capability === "competition_consulting") {
    return "围绕数学竞赛备赛，规划训练路径并参考竞赛资料。";
  }
  return "围绕学习问题进行连续交流。";
}

/**
 * 渲染新版演示聊天工作区。
 *
 * 输入：
 *   initialCapability: 页面入口指定的默认能力。
 * 输出：
 *   返回带有居中对话区、知识库选择和知识库来源面板的工作区。
 */
export function ChatWorkspace({
  initialCapability = "chat",
  shellTitle,
  showCapabilitySelector = false
}: {
  initialCapability?: CapabilityName;
  shellTitle?: string;
  showCapabilitySelector?: boolean;
}) {
  const chat = useUnifiedChat(initialCapability);
  const knowledge = useKnowledgeBases();
  const [knowledgeInitialized, setKnowledgeInitialized] = useState(false);
  const workspaceTitle = workspaceTitles[chat.capability];
  const ragEnabled = chat.tools.includes("rag");
  const selectedKnowledgeBase = chat.knowledgeBases[0] || "";
  const setKnowledgeBases = chat.setKnowledgeBases;

  useEffect(() => {
    if (knowledgeInitialized || !knowledge.items.length) return;
    if (selectedKnowledgeBase) {
      setKnowledgeInitialized(true);
      return;
    }
    const defaultName = defaultKnowledgeBaseName(knowledge.items);
    if (defaultName) setKnowledgeBases([defaultName]);
    setKnowledgeInitialized(true);
  }, [
    knowledge.items,
    knowledgeInitialized,
    selectedKnowledgeBase,
    setKnowledgeBases
  ]);

  /**
   * 手动选择当前会话使用的知识库。
   *
   * 输入：
   *   value: select 当前选中的知识库名称；空字符串表示无知识库。
   * 输出：
   *   无；更新聊天状态中的知识库选择。
   */
  function handleKnowledgeBaseChange(value: string) {
    setKnowledgeBases(value ? [value] : []);
  }

  return (
    <AppShell
      title={shellTitle || workspaceTitle}
      subtitle={workspaceSubtitle(chat.capability, shellTitle)}
      status={chat.status}
      inspector={
        <RightInspector
          events={chat.events}
          ragEnabled={ragEnabled}
          knowledgeBases={selectedKnowledgeBase ? [selectedKnowledgeBase] : []}
          waiting={chat.waitingForAssistant}
        />
      }
      history={{
        activeSessionId: chat.sessionId,
        currentCapability: chat.capability,
        refreshToken: chat.historyRefreshToken,
        onSelectSession: chat.loadSession,
        onNewSession: chat.newSession
      }}
    >
      <div className="flex h-full flex-col bg-page">
        <div className="flex min-h-0 w-full flex-1 flex-col px-6">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink">
                {shellTitle || workspaceTitle}
              </div>
              <div className="mt-1 truncate text-xs text-muted">
                {shellTitle ? `${workspaceTitle} · ` : ""}
                知识库：
                {ragEnabled ? selectedKnowledgeBase || "无知识库" : "RAG 未启用"}
              </div>
            </div>
            {showCapabilitySelector ? (
              <CapabilitySelector
                value={chat.capability}
                onChange={chat.setCapability}
              />
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 pb-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              <span>知识库</span>
              <select
                value={selectedKnowledgeBase}
                onChange={(event) => handleKnowledgeBaseChange(event.target.value)}
                disabled={!ragEnabled}
                title={ragEnabled ? "选择知识库" : "开启 RAG 后可选择知识库"}
                className={cn(
                  "h-8 min-w-[180px] rounded-md border border-borderline",
                  "bg-white px-2 text-xs text-ink outline-none transition",
                  "focus:border-accent disabled:cursor-not-allowed",
                  "disabled:bg-slate-50 disabled:text-muted"
                )}
              >
                <option value="">{ragEnabled ? "无知识库" : "RAG 未启用"}</option>
                {knowledge.items.map((kb) => (
                  <option key={kb.name} value={kb.name}>
                    {kb.name}
                    {kb.is_default ? "（默认）" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
            <MessageList
              messages={chat.messages}
              waiting={chat.waitingForAssistant}
              events={chat.events}
            />
          </div>
          <Composer
            onSend={(content, attachments) =>
              chat.send(
                content,
                selectedKnowledgeBase ? [selectedKnowledgeBase] : [],
                attachments
              )
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
