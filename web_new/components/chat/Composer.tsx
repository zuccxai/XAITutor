"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, FormEvent } from "react";
import { ArrowUp, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ChatAttachment } from "@/lib/types/chat";
import {
  formatBytes,
  imageFileToAttachment,
  IMAGE_ATTACHMENT_ACCEPT,
  isSupportedImageFile,
  MAX_IMAGE_ATTACHMENT_BYTES,
  MAX_IMAGE_ATTACHMENT_TOTAL_BYTES
} from "@/lib/image-attachments";

/**
 * 获取图片附件预览地址。
 *
 * 输入：
 *   attachment: 当前图片附件。
 * 输出：
 *   返回可用于 Image 组件展示的地址；没有内容时返回空字符串。
 */
function attachmentPreviewSrc(attachment: ChatAttachment): string {
  if (attachment.previewUrl) return attachment.previewUrl;
  if (attachment.url) return attachment.url;
  if (attachment.base64) {
    return `data:${attachment.mime_type || "image/png"};base64,${attachment.base64}`;
  }
  return "";
}

/**
 * 渲染聊天输入框。
 *
 * 输入：
 *   onSend: 提交文本和图片附件时调用的发送函数。
 * 输出：
 *   返回底部输入卡片，通过 onSend 产生发送副作用。
 */
export function Composer({
  onSend
}: {
  onSend: (content: string, attachments: ChatAttachment[]) => void;
}) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canSend = value.trim().length > 0 || attachments.length > 0;

  /**
   * 校验并读取用户选择的图片。
   *
   * 输入：
   *   files: 文件选择器返回的图片文件列表。
   * 输出：
   *   无；通过 setAttachments 更新待发送图片，通过 setError 展示校验错误。
   */
  async function addImages(files: File[]) {
    if (!files.length) return;
    setError(null);
    setLoadingImages(true);
    let runningTotal = attachments.reduce(
      (total, item) => total + (item.size || 0),
      0
    );
    const accepted: File[] = [];
    let nextError: string | null = null;

    for (const file of files) {
      if (!isSupportedImageFile(file)) {
        nextError = `不支持的图片格式：${file.name}`;
        continue;
      }
      if (file.size > MAX_IMAGE_ATTACHMENT_BYTES) {
        nextError = `图片过大：${file.name}，单张不能超过 ${formatBytes(
          MAX_IMAGE_ATTACHMENT_BYTES
        )}`;
        continue;
      }
      if (runningTotal + file.size > MAX_IMAGE_ATTACHMENT_TOTAL_BYTES) {
        nextError = `图片总大小不能超过 ${formatBytes(
          MAX_IMAGE_ATTACHMENT_TOTAL_BYTES
        )}`;
        break;
      }
      runningTotal += file.size;
      accepted.push(file);
    }

    try {
      const nextAttachments = await Promise.all(
        accepted.map(imageFileToAttachment)
      );
      if (nextAttachments.length) {
        setAttachments((current) => [...current, ...nextAttachments]);
      }
    } catch {
      nextError = "图片读取失败，请重新选择。";
    } finally {
      setLoadingImages(false);
      if (nextError) setError(nextError);
    }
  }

  /**
   * 处理图片选择器变更。
   *
   * 输入：
   *   event: input[type=file] 的 change 事件。
   * 输出：
   *   无；读取图片后清空 input，保证同一文件可重复选择。
   */
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await addImages(Array.from(event.target.files || []));
    event.target.value = "";
  }

  /**
   * 处理剪贴板里的图片。
   *
   * 输入：
   *   event: 文本框 paste 事件。
   * 输出：
   *   无；当剪贴板包含图片时追加到待发送附件。
   */
  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files || []);
    if (!files.length) return;
    event.preventDefault();
    await addImages(files);
  }

  /**
   * 移除待发送图片。
   *
   * 输入：
   *   index: 要移除的附件下标。
   * 输出：
   *   无；更新本地待发送附件列表。
   */
  function removeAttachment(index: number) {
    setAttachments((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  /**
   * 提交当前输入。
   *
   * 输入：
   *   event: 表单提交事件。
   * 输出：
   *   无；通过 onSend 发送文本和图片，并清空输入状态。
   */
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend || loadingImages) return;
    onSend(value.trim(), attachments);
    setValue("");
    setAttachments([]);
    setError(null);
  }

  return (
    <form onSubmit={submit} className="shrink-0 pb-5 pt-2">
      <div className="rounded-2xl border border-borderline bg-white p-3 shadow-panel">
        {attachments.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => {
              const src = attachmentPreviewSrc(attachment);
              return (
                <div
                  key={`${attachment.filename || "image"}-${index}`}
                  className="group relative h-20 w-20 overflow-hidden rounded-xl border border-borderline bg-slate-50"
                  title={attachment.filename}
                >
                  {src ? (
                    <Image
                      src={src}
                      alt={attachment.filename || "上传图片"}
                      fill
                      sizes="80px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/65 text-white opacity-90 transition hover:bg-black"
                    title="移除图片"
                    aria-label="移除图片"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onPaste={handlePaste}
          className="min-h-24 w-full resize-none rounded-xl border-0 bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-muted"
          placeholder="输入学习问题、题目或研究任务..."
        />
        {error ? (
          <div className="mt-2 px-2 text-xs text-danger">{error}</div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ATTACHMENT_ACCEPT}
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="ghost"
            className="size-9 rounded-full p-0 text-muted hover:text-ink"
            onClick={() => fileInputRef.current?.click()}
            disabled={loadingImages}
            title="上传图片"
            aria-label="上传图片"
          >
            <ImagePlus size={18} />
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="size-9 rounded-full p-0"
            disabled={!canSend || loadingImages}
            title="发送"
            aria-label="发送"
          >
            <ArrowUp size={17} strokeWidth={2.4} />
          </Button>
        </div>
      </div>
    </form>
  );
}
