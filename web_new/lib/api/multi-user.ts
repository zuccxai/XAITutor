import { requestJson } from "@/lib/api/client";
import type { GrantPayload, MultiUserResources } from "@/features/multi-user/types";

/**
 * 获取管理员可分配资源。
 *
 * 输入：无。
 * 输出：返回模型、知识库和技能资源清单。
 */
export async function fetchAdminResources(): Promise<MultiUserResources> {
  return requestJson<MultiUserResources>("/api/v1/multi-user/admin/resources");
}

/**
 * 获取某个用户当前授权。
 *
 * 输入：
 *   userId: 用户 ID。
 * 输出：返回授权配置。
 */
export async function fetchUserGrant(userId: string): Promise<GrantPayload> {
  const data = await requestJson<{ grant: GrantPayload }>(
    `/api/v1/multi-user/users/${encodeURIComponent(userId)}/grants`
  );
  return data.grant;
}

/**
 * 保存某个用户的资源授权。
 *
 * 输入：
 *   userId: 用户 ID。
 *   grant: 新授权配置。
 * 输出：返回后端保存后的授权配置。
 */
export async function saveUserGrant(
  userId: string,
  grant: GrantPayload
): Promise<GrantPayload> {
  const data = await requestJson<{ grant: GrantPayload }>(
    `/api/v1/multi-user/users/${encodeURIComponent(userId)}/grants`,
    {
      method: "PUT",
      body: JSON.stringify({ grant })
    }
  );
  return data.grant;
}

/**
 * 获取当前用户可访问资源摘要。
 *
 * 输入：无。
 * 输出：返回当前用户的授权资源信息。
 */
export async function fetchMyAccess(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/api/v1/multi-user/me/access");
}
