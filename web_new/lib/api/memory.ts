import { requestJson } from "@/lib/api/client";
import type {
  MemoryApiData,
  MemoryClearPayload,
  MemoryRefreshPayload,
  MemoryUpdatePayload
} from "@/lib/types/memory";

/**
 * 获取长期记忆快照。
 *
 * 输入：
 *   无。
 * 输出：
 *   返回学习摘要和学习画像内容。
 */
export async function getMemory(): Promise<MemoryApiData> {
  return requestJson<MemoryApiData>("/api/v1/memory");
}

/**
 * 保存指定记忆文件。
 *
 * 输入：
 *   payload: 记忆文件类型和新内容。
 * 输出：
 *   返回保存后的完整记忆快照。
 */
export async function updateMemory(
  payload: MemoryUpdatePayload
): Promise<MemoryApiData> {
  return requestJson<MemoryApiData>("/api/v1/memory", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

/**
 * 从最近会话或指定会话刷新记忆。
 *
 * 输入：
 *   payload: 可选会话 ID 和语言。
 * 输出：
 *   返回刷新后的完整记忆快照。
 */
export async function refreshMemory(
  payload: MemoryRefreshPayload = {}
): Promise<MemoryApiData> {
  return requestJson<MemoryApiData>("/api/v1/memory/refresh", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * 清空指定记忆文件。
 *
 * 输入：
 *   payload: 可选记忆文件类型；不传时后端会清空全部。
 * 输出：
 *   返回清空后的完整记忆快照。
 */
export async function clearMemory(
  payload: MemoryClearPayload = {}
): Promise<MemoryApiData> {
  return requestJson<MemoryApiData>("/api/v1/memory/clear", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
