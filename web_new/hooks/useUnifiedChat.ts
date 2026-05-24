"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UnifiedWsClient } from "@/lib/ws/unified-ws";
import type {
  CapabilityName,
  ChatAttachment,
  ChatMessage,
  LLMSelection,
  RequestSnapshot,
  ToolName
} from "@/lib/types/chat";
import type { StreamEvent } from "@/lib/types/stream";
import { defaultToolsForCapability, fromBackendCapability, toBackendCapability } from "@/lib/capabilities";
import { DEFAULT_LANGUAGE } from "@/lib/config";
import { getSession } from "@/lib/api/sessions";
import type { SessionDetail, SessionMessage } from "@/lib/types/session";
import { toAttachmentPayload } from "@/lib/image-attachments";

/**
 * 生成前端临时消息 ID。
 *
 * 输入：无。
 * 输出：返回稳定性足够的本地消息 ID。
 */
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 从 session 事件中提取后端会话标识。
 *
 * 输入：
 *   event: 后端 WebSocket 流式事件。
 * 输出：返回会话标识；没有时返回空字符串。
 */
function extractSessionId(event: StreamEvent): string {
  return event.session_id || String(event.metadata?.session_id || event.metadata?.id || "");
}

/**
 * 提取消息中保存的请求快照。
 *
 * 输入：
 *   message: 后端学习记录消息。
 * 输出：返回请求快照；没有时返回 undefined。
 */
function messageSnapshot(message: SessionMessage): RequestSnapshot | undefined {
  return message.metadata?.request_snapshot || message.metadata_json?.request_snapshot;
}

/**
 * 提取学习记录消息所属能力。
 *
 * 输入：
 *   message: 后端学习记录消息。
 * 输出：返回 web_new 内部能力标识；没有能力时返回 undefined。
 */
function extractMessageCapability(message: SessionMessage): CapabilityName | undefined {
  const snapshot = messageSnapshot(message);
  const capability = snapshot?.capability || message.capability;
  return capability ? fromBackendCapability(capability) : undefined;
}

/**
 * 推断学习记录所属能力。
 *
 * 输入：
 *   detail: 后端会话详情。
 * 输出：返回 web_new 内部能力标识。
 */
function normalizeSessionCapability(detail: SessionDetail): CapabilityName {
  const preferred = fromBackendCapability(detail.preferences?.capability);
  if (preferred !== "chat") return preferred;
  const firstSnapshot = detail.messages.map(messageSnapshot).find(Boolean);
  if (firstSnapshot?.capability) return fromBackendCapability(firstSnapshot.capability);
  const firstCapability = detail.messages.find((message) => message.capability)?.capability;
  return fromBackendCapability(firstCapability);
}

/**
 * 将后端学习记录消息转换为前端消息。
 *
 * 输入：
 *   messages: 后端返回的会话消息列表。
 * 输出：返回前端可直接渲染的消息列表。
 */
function hydrateSessionMessages(messages: SessionMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const snapshot = messageSnapshot(message);
      return {
        id: String(message.id),
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
        capability: extractMessageCapability(message),
        attachments: message.attachments || snapshot?.attachments || [],
        events: message.events || []
      };
    });
}

/**
 * 获取会话中最后一个用户请求快照。
 *
 * 输入：
 *   detail: 后端会话详情。
 * 输出：返回最后一个用户消息的请求快照；没有时返回 undefined。
 */
function lastUserSnapshot(detail: SessionDetail): RequestSnapshot | undefined {
  return [...detail.messages]
    .reverse()
    .filter((message) => message.role === "user")
    .map(messageSnapshot)
    .find(Boolean);
}

/**
 * 管理 web_new 聊天状态和 WebSocket 调用。
 *
 * 输入：
 *   initialCapability: 页面入口指定的初始能力。
 * 输出：返回消息、事件、连接状态、等待状态、模型选择和发送/加载控制函数。
 */
export function useUnifiedChat(initialCapability: CapabilityName = "chat") {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "closed">("idle");
  const [capability, setCapability] = useState<CapabilityName>(initialCapability);
  const [tools, setTools] = useState<ToolName[]>(() => defaultToolsForCapability(initialCapability));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<string[]>([]);
  const [llmSelection, setLlmSelection] = useState<LLMSelection | null>(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [waitingForAssistant, setWaitingForAssistant] = useState(false);
  const clientRef = useRef<UnifiedWsClient | null>(null);
  const capabilityRef = useRef<CapabilityName>(initialCapability);

  useEffect(() => {
    capabilityRef.current = capability;
  }, [capability]);

  const client = useMemo(() => {
    return new UnifiedWsClient(
      (event) => {
        if (event.type === "session") {
          const nextSessionId = extractSessionId(event);
          if (nextSessionId) {
            setSessionId(nextSessionId);
            setHistoryRefreshToken((current) => current + 1);
          }
        }
        if (event.type === "done") {
          setWaitingForAssistant(false);
          setHistoryRefreshToken((current) => current + 1);
        }
        if (event.type === "error") {
          setWaitingForAssistant(false);
          setMessages((current) => [
            ...current,
            {
              id: createId(),
              role: "assistant",
              content: event.content || "本轮处理失败，请查看运行过程。",
              createdAt: Date.now(),
              capability: capabilityRef.current,
              events: [event]
            }
          ]);
        }
        setEvents((current) => [...current, event]);
        if (event.type === "content" && event.content) {
          setMessages((current) => {
            const last = current[current.length - 1];
            if (last?.role === "assistant") {
              return [
                ...current.slice(0, -1),
                { ...last, content: last.content + event.content, events: [...(last.events || []), event] }
              ];
            }
            return [
              ...current,
              {
                id: createId(),
                role: "assistant",
                content: event.content || "",
                createdAt: Date.now(),
                capability: capabilityRef.current,
                events: [event]
              }
            ];
          });
        }
      },
      setStatus
    );
  }, []);

  useEffect(() => {
    clientRef.current = client;
    client.connect();
    return () => client.close();
  }, [client]);

  /**
   * 发送用户输入到统一 WebSocket。
   *
   * 输入：
   *   content: 用户输入内容。
   *   activeKnowledgeBases: 当前手动选择的知识库列表。
   *   attachments: 用户本轮上传的图片附件。
   * 输出：无；通过 WebSocket 发送 start_turn，并更新本地消息与事件状态。
   */
  function send(
    content: string,
    activeKnowledgeBases: string[] = [],
    attachments: ChatAttachment[] = []
  ) {
    const text = content.trim();
    if (!text && !attachments.length) return;
    const outgoingAttachments = toAttachmentPayload(attachments);
    const requestKnowledgeBases = tools.includes("rag") ? activeKnowledgeBases : [];
    setKnowledgeBases(activeKnowledgeBases);
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
        capability,
        attachments
      }
    ]);
    setEvents([]);
    setWaitingForAssistant(true);
    clientRef.current?.send({
      type: "start_turn",
      content: text || "请分析上传的图片。",
      capability: toBackendCapability(capability),
      tools,
      knowledge_bases: requestKnowledgeBases,
      llm_selection: llmSelection,
      memory_references: [],
      skills: [],
      attachments: outgoingAttachments,
      session_id: sessionId,
      language: DEFAULT_LANGUAGE
    });
  }

  /**
   * 切换工具启用状态。
   *
   * 输入：
   *   tool: 要切换的工具名称。
   * 输出：无；更新本地工具列表。
   */
  function toggleTool(tool: ToolName) {
    setTools((current) => (current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool]));
  }

  /**
   * 切换能力并恢复该能力默认工具。
   *
   * 输入：
   *   nextCapability: 目标能力标识。
   * 输出：无；更新能力和默认工具。
   */
  function changeCapability(nextCapability: CapabilityName) {
    setCapability(nextCapability);
    setTools(defaultToolsForCapability(nextCapability));
  }

  /**
   * 加载后端学习记录。
   *
   * 输入：
   *   targetSessionId: 要加载的后端会话标识。
   * 输出：返回加载完成的 Promise；同时恢复消息、能力、工具、知识库和模型选择状态。
   */
  async function loadSession(targetSessionId: string): Promise<void> {
    const detail = await getSession(targetSessionId);
    const snapshot = lastUserSnapshot(detail);
    const nextCapability = normalizeSessionCapability(detail);
    const nextKnowledgeBases = snapshot?.knowledge_bases || detail.preferences?.knowledge_bases || [];
    const nextTools = (snapshot?.tools as ToolName[] | undefined) || defaultToolsForCapability(nextCapability);
    const nextMessages = hydrateSessionMessages(detail.messages || []);
    const lastAssistant = [...nextMessages].reverse().find((message) => message.role === "assistant");

    setSessionId(detail.session_id || detail.id);
    setWaitingForAssistant(false);
    setCapability(nextCapability);
    setTools(nextTools);
    setKnowledgeBases(nextKnowledgeBases);
    setLlmSelection(snapshot?.llm_selection || detail.preferences?.llm_selection || null);
    setMessages(nextMessages);
    setEvents(lastAssistant?.events || []);
  }

  /**
   * 新建当前能力下的空会话。
   *
   * 输入：
   *   nextCapability: 可选目标能力；不传则使用当前能力。
   * 输出：无；清空本地会话并重置工具。
   */
  function newSession(nextCapability: CapabilityName = capability) {
    setSessionId(null);
    setEvents([]);
    setMessages([]);
    setWaitingForAssistant(false);
    setCapability(nextCapability);
    setTools(defaultToolsForCapability(nextCapability));
  }

  return {
    events,
    messages,
    status,
    waitingForAssistant,
    sessionId,
    capability,
    setCapability: changeCapability,
    tools,
    knowledgeBases,
    setKnowledgeBases,
    llmSelection,
    setLlmSelection,
    historyRefreshToken,
    toggleTool,
    send,
    loadSession,
    newSession
  };
}
