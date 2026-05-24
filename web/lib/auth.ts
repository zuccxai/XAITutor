import { requestJson } from "@/lib/api";

export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

export interface AuthStatus {
  enabled: boolean;
  authenticated: boolean;
  user_id?: string;
  username?: string;
  role?: string;
  is_admin?: boolean;
}

/**
 * 读取当前登录状态。
 *
 * 输入：无。
 * 输出：返回后端认证状态；网络失败时返回 null，方便页面降级。
 */
export async function fetchAuthStatus(): Promise<AuthStatus | null> {
  try {
    return await requestJson<AuthStatus>("/api/v1/auth/status");
  } catch {
    if (!AUTH_ENABLED) {
      return { enabled: false, authenticated: true, role: "admin", is_admin: true };
    }
    return null;
  }
}

/**
 * 提交登录凭据。
 *
 * 输入：
 *   username: 用户名或邮箱。
 *   password: 密码。
 * 输出：返回登录是否成功以及失败原因。
 */
export async function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requestJson("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "登录失败" };
  }
}

/**
 * 注册新用户。
 *
 * 输入：
 *   username: 用户名或邮箱。
 *   password: 密码。
 * 输出：返回注册结果，首个用户会由后端授予管理员身份。
 */
export async function register(
  username: string,
  password: string,
): Promise<{
  ok: boolean;
  role?: string;
  is_first_user?: boolean;
  error?: string;
}> {
  try {
    const data = await requestJson<{ role?: string; is_first_user?: boolean }>(
      "/api/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
    );
    return { ok: true, role: data.role, is_first_user: data.is_first_user };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "注册失败" };
  }
}

/**
 * 检查当前是否还没有任何注册用户。
 *
 * 输入：无。
 * 输出：返回 true 表示下一位注册用户会成为管理员。
 */
export async function checkIsFirstUser(): Promise<boolean> {
  if (!AUTH_ENABLED) return false;
  try {
    const data = await requestJson<{ is_first_user?: boolean }>(
      "/api/v1/auth/is_first_user",
    );
    return Boolean(data.is_first_user);
  } catch {
    return false;
  }
}

/**
 * 注销当前用户。
 *
 * 输入：无。
 * 输出：无；后端会清理认证 Cookie。
 */
export async function logout(): Promise<void> {
  try {
    await requestJson("/api/v1/auth/logout", { method: "POST" });
  } catch {
    // 注销失败时仍允许前端跳转登录页。
  }
}
