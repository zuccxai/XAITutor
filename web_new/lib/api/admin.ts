import { requestJson } from "@/lib/api/client";

export interface UserRecord {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
  disabled?: boolean;
}

export interface CreatedUser {
  user_id: string;
  username: string;
  role: "admin" | "user";
  is_admin: boolean;
}

/**
 * 获取用户列表。
 *
 * 输入：无。
 * 输出：返回当前系统中的用户摘要。
 */
export async function listUsers(): Promise<UserRecord[]> {
  return requestJson<UserRecord[]>("/api/v1/auth/users");
}

/**
 * 管理员创建用户。
 *
 * 输入：
 *   username: 用户名或邮箱。
 *   password: 初始密码。
 * 输出：返回新建用户信息。
 */
export async function createUser(username: string, password: string): Promise<CreatedUser> {
  return requestJson<CreatedUser>("/api/v1/auth/users", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

/**
 * 删除指定用户。
 *
 * 输入：
 *   username: 要删除的用户名。
 * 输出：无。
 */
export async function deleteUser(username: string): Promise<void> {
  await requestJson(`/api/v1/auth/users/${encodeURIComponent(username)}`, {
    method: "DELETE"
  });
}

/**
 * 修改用户角色。
 *
 * 输入：
 *   username: 目标用户名。
 *   role: 新角色。
 * 输出：无。
 */
export async function setUserRole(username: string, role: "admin" | "user"): Promise<void> {
  await requestJson(`/api/v1/auth/users/${encodeURIComponent(username)}/role`, {
    method: "PUT",
    body: JSON.stringify({ role })
  });
}
