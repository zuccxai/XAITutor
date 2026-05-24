import { requestJson } from "@/lib/api/client";
import type { SessionDetail, SessionSummary } from "@/lib/types/session";

/**
 * 获取学习记录列表。
 *
 * 输入：
 *   limit: 返回数量上限。
 *   offset: 分页偏移。
 * 输出：返回后端保存的学习记录摘要列表。
 */
export async function listSessions(limit = 80, offset = 0): Promise<SessionSummary[]> {
  const data = await requestJson<{ sessions?: SessionSummary[] }>(
    `/api/v1/sessions?limit=${limit}&offset=${offset}`
  );
  return data.sessions || [];
}

/**
 * 获取单个学习记录详情。
 *
 * 输入：
 *   sessionId: 后端会话标识。
 * 输出：返回会话详情与消息列表。
 */
export async function getSession(sessionId: string): Promise<SessionDetail> {
  return requestJson<SessionDetail>(`/api/v1/sessions/${encodeURIComponent(sessionId)}`);
}

/**
 * 重命名学习记录。
 *
 * 输入：
 *   sessionId: 后端会话标识。
 *   title: 新会话标题。
 * 输出：返回更新后的会话摘要。
 */
export async function renameSession(sessionId: string, title: string): Promise<SessionSummary> {
  const data = await requestJson<{ session?: SessionSummary }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title })
    }
  );
  if (!data.session) throw new Error("重命名学习记录失败");
  return data.session;
}

/**
 * 删除学习记录。
 *
 * 输入：
 *   sessionId: 后端会话标识。
 * 输出：无；后端删除会话及其消息。
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await requestJson<{ deleted?: boolean; session_id?: string }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE"
    }
  );
}
