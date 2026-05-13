"use client";

import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { cn } from "@/lib/cn";
import { apiUrl } from "@/lib/config";
import type { ChatAttachment, ChatMessage } from "@/lib/types/chat";
import type { StreamEvent } from "@/lib/types/stream";

type PreviewImage = {
  src: string;
  alt: string;
};

const stageLabels: Record<string, string> = {
  recognition: "识别题目图片",
  retrieval: "检索知识库原题",
  matching: "判断是否命中原题",
  solving: "深度解题",
  writing: "整理答案"
};

/**
 * 获取消息图片附件的展示地址。
 *
 * 输入：
 *   attachment: 消息中的图片附件。
 * 输出：
 *   返回可用于 img 标签展示的地址；没有内容时返回空字符串。
 */
function attachmentSrc(attachment: ChatAttachment): string {
  if (attachment.url) {
    if (/^(https?:|data:|blob:)/.test(attachment.url)) return attachment.url;
    return apiUrl(attachment.url);
  }
  if (attachment.previewUrl) return attachment.previewUrl;
  if (attachment.base64) {
    return `data:${attachment.mime_type || "image/png"};base64,${attachment.base64}`;
  }
  return "";
}

/**
 * 渲染用户消息里的图片附件。
 *
 * 输入：
 *   attachments: 当前消息携带的附件列表。
 *   onPreview: 用户点击缩略图时触发的大图预览回调。
 * 输出：
 *   返回图片缩略图列表；没有图片时返回 null。
 */
function MessageImages({
  attachments = [],
  onPreview
}: {
  attachments?: ChatAttachment[];
  onPreview: (image: PreviewImage) => void;
}) {
  const images = attachments.filter(
    (attachment) => attachment.type === "image" && attachmentSrc(attachment)
  );
  if (!images.length) return null;

  return (
    <div className="mb-2 flex flex-wrap justify-end gap-2">
      {images.map((attachment, index) => {
        const src = attachmentSrc(attachment);
        const alt = attachment.filename || "上传图片";

        return (
          <button
            key={`${attachment.filename || "image"}-${index}`}
            type="button"
            className={cn(
              "relative h-28 w-36 overflow-hidden rounded-xl border border-borderline",
              "bg-slate-50 transition hover:border-accent hover:shadow-panel",
              "focus:outline-none focus:ring-2 focus:ring-accent/35"
            )}
            title={alt}
            onClick={() => onPreview({ src, alt })}
          >
            {/* 附件地址来自后端上传接口，使用原生 img 避免 next/image 对动态后端地址的限制。 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * 渲染图片大图预览遮罩。
 *
 * 输入：
 *   image: 当前要预览的图片；为空时不展示。
 *   onClose: 关闭预览时执行的回调。
 * 输出：
 *   返回遮罩层节点；没有预览图片时返回 null。
 */
function ImagePreviewDialog({
  image,
  onClose
}: {
  image: PreviewImage | null;
  onClose: () => void;
}) {
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-h-full max-w-5xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={cn(
            "absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center",
            "justify-center rounded-full bg-black/55 text-white transition",
            "hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/70"
          )}
          aria-label="关闭图片预览"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        {/* 大图同样使用原生 img，确保历史附件和临时预览地址都能直接展示。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          className="max-h-[88vh] max-w-[92vw] rounded-2xl bg-white object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}

/**
 * 获取当前后台运行状态文案。
 *
 * 输入：
 *   events: 本轮后端流式事件。
 *   waiting: 当前是否仍在等待本轮完成。
 * 输出：
 *   返回用于消息区展示的状态标题和说明。
 */
function runtimeStatus(events: StreamEvent[], waiting?: boolean) {
  const last = [...events].reverse().find((event) => event.type !== "session");
  if (!last && waiting) {
    return {
      tone: "running",
      title: "已提交，等待后端响应",
      detail: "正在建立本轮任务。"
    };
  }
  if (!last) return null;
  if (last.type === "done") {
    return { tone: "done", title: "本轮已完成", detail: "可以继续追问或上传下一张题目图片。" };
  }
  if (last.type === "error") {
    return {
      tone: "error",
      title: "本轮处理失败",
      detail: last.content || "请查看右侧运行过程。"
    };
  }
  const stage = last.stage ? stageLabels[last.stage] || last.stage : "";
  const content = last.content?.trim();
  if (last.type === "content") {
    return { tone: "running", title: "正在生成答案", detail: stage || "答案仍在输出中。" };
  }
  if (last.type === "progress") {
    return {
      tone: "running",
      title: stage || "后台正在处理",
      detail: content || "任务仍在运行。"
    };
  }
  if (last.type === "tool_call") {
    return {
      tone: "running",
      title: "正在调用工具",
      detail: content || stage || "等待工具返回。"
    };
  }
  if (last.type === "tool_result") {
    return { tone: "running", title: "工具已返回", detail: stage || "正在继续处理结果。" };
  }
  if (last.type === "thinking" || last.type === "observation") {
    return {
      tone: "running",
      title: stage || "模型正在分析",
      detail: content || "正在组织中间结果。"
    };
  }
  return {
    tone: waiting ? "running" : "done",
    title: waiting ? "后台正在处理" : "本轮状态已更新",
    detail: stage || `收到 ${last.type} 事件。`
  };
}

/**
 * 渲染本轮后台运行状态卡。
 *
 * 输入：
 *   events: 本轮后端流式事件。
 *   waiting: 当前是否仍在等待本轮完成。
 * 输出：
 *   返回状态卡；没有可展示状态时返回 null。
 */
function RuntimeStatusCard({
  events,
  waiting
}: {
  events: StreamEvent[];
  waiting?: boolean;
}) {
  const status = runtimeStatus(events, waiting);
  if (!status) return null;
  const done = status.tone === "done";
  const error = status.tone === "error";
  const Icon = error ? XCircle : done ? CheckCircle2 : Loader2;

  return (
    <article className="w-full">
      <div
        className={cn(
          "inline-flex max-w-full items-start gap-2 rounded-lg border px-3 py-2",
          "bg-white text-sm shadow-panel",
          error ? "border-red-200 text-danger" : "border-borderline text-ink"
        )}
      >
        <Icon
          size={16}
          className={cn(
            "mt-0.5 shrink-0",
            !done && !error && "animate-spin text-accent",
            done && "text-emerald-600",
            error && "text-danger"
          )}
        />
        <div className="min-w-0">
          <div className="font-medium">{status.title}</div>
          <div className="mt-0.5 break-words text-xs leading-5 text-muted">
            {status.detail}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * 渲染助手等待提示。
 *
 * 输入：
 *   无。
 * 输出：
 *   返回带转圈图标的等待状态。
 */
function AssistantWaiting() {
  return (
    <article className="w-full">
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-borderline",
          "bg-white px-3 py-2 text-sm text-muted shadow-panel"
        )}
      >
        <Loader2 size={16} className="animate-spin text-accent" />
        <span>小海正在思考...</span>
      </div>
    </article>
  );
}

/**
 * 渲染对话消息列表。
 *
 * 输入：
 *   messages: 当前会话中的消息数组。
 *   waiting: 是否正在等待助手返回。
 * 输出：
 *   返回空状态或用户、助手消息内容。
 */
export function MessageList({
  messages,
  waiting,
  events = []
}: {
  messages: ChatMessage[];
  waiting?: boolean;
  events?: StreamEvent[];
}) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const hasContent = useMemo(
    () => messages.length > 0 || Boolean(waiting),
    [messages.length, waiting]
  );

  if (!hasContent) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center text-center">
        <div>
          <h2 className="font-serif text-[34px] font-medium tracking-normal text-ink">
            今天想学什么？
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            把教材、题目或研究线索交给我。
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-7 py-2 pr-3">
        {messages.map((message) => (
          <article
            key={message.id}
            className={message.role === "user" ? "flex justify-end" : "w-full"}
          >
            <div
              className={
                message.role === "user"
                  ? cn(
                      "max-w-[75%] rounded-2xl bg-secondary px-4 py-2.5",
                      "text-sm leading-7 text-ink shadow-panel"
                    )
                  : "max-w-none text-sm leading-7 text-ink"
              }
            >
              {message.role !== "user" ? (
                <div className="mb-1 text-xs font-medium text-muted">
                  {message.role === "assistant" ? "小海" : "系统"}
                </div>
              ) : null}
              {message.role === "user" ? (
                <MessageImages
                  attachments={message.attachments}
                  onPreview={setPreviewImage}
                />
              ) : null}
              {message.content ? (
                <MarkdownContent content={message.content} />
              ) : null}
            </div>
          </article>
        ))}
        {waiting && !messages.some((message) => message.role === "assistant") ? (
          <AssistantWaiting />
        ) : null}
        <RuntimeStatusCard events={events} waiting={waiting} />
      </div>
      <ImagePreviewDialog
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}
