"use client";

import type { ChatAttachment } from "@/lib/types/chat";

export const IMAGE_ATTACHMENT_ACCEPT = "image/*";
export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
  ".heic",
  ".heif"
]);

/**
 * 读取文件为 data URL。
 *
 * 输入：
 *   file: 浏览器 File 对象。
 * 输出：
 *   返回包含 MIME 和 base64 内容的 data URL。
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 从 data URL 中提取 base64 正文。
 *
 * 输入：
 *   dataUrl: FileReader 读取出的 data URL。
 * 输出：
 *   返回不含 data URL 头部的 base64 字符串。
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
}

/**
 * 获取文件扩展名。
 *
 * 输入：
 *   filename: 文件名。
 * 输出：
 *   返回小写扩展名；没有扩展名时返回空字符串。
 */
function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

/**
 * 判断文件是否为可发送给视觉模型的图片。
 *
 * 输入：
 *   file: 用户选择的文件。
 * 输出：
 *   返回是否接受该图片；SVG 不作为图片附件发送。
 */
export function isSupportedImageFile(file: File): boolean {
  if (file.type === "image/svg+xml" || extensionOf(file.name) === ".svg") {
    return false;
  }
  if (file.type && file.type.startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

/**
 * 格式化文件大小。
 *
 * 输入：
 *   bytes: 字节数。
 * 输出：
 *   返回适合界面展示的大小文本。
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 将图片文件转成聊天附件。
 *
 * 输入：
 *   file: 已通过类型和大小校验的图片文件。
 * 输出：
 *   返回可用于本地预览和 WebSocket payload 的图片附件。
 */
export async function imageFileToAttachment(file: File): Promise<ChatAttachment> {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    type: "image",
    filename: file.name,
    base64: extractBase64FromDataUrl(dataUrl),
    mime_type: file.type || undefined,
    previewUrl: dataUrl,
    size: file.size
  };
}

/**
 * 构建发送给后端的附件 payload。
 *
 * 输入：
 *   attachments: 前端当前保留的图片附件。
 * 输出：
 *   返回去掉预览字段后的附件数组。
 */
export function toAttachmentPayload(attachments: ChatAttachment[]): ChatAttachment[] {
  return attachments.map((attachment) => ({
    type: attachment.type,
    filename: attachment.filename,
    base64: attachment.base64,
    mime_type: attachment.mime_type
  }));
}
