import { apiUrl, AUTH_ENABLED } from "@/lib/config";

/**
 * 从后端错误响应中提取可读错误。
 *
 * 输入：
 *   response: fetch 返回的错误响应。
 *   fallback: 无法解析时使用的默认错误文本。
 * 输出：返回可展示给用户的错误说明。
 */
async function readErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown; error?: unknown };
    const detail = body.detail || body.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown };
      if (first?.msg) return String(first.msg);
    }
  } catch {
    // 响应体不是 JSON 时使用 fallback。
  }
  return response.statusText || fallback;
}

/**
 * 在开启认证且登录失效时跳转登录页。
 *
 * 输入：
 *   response: 后端响应。
 * 输出：无；必要时通过 window.location 产生跳转副作用。
 */
function redirectOnUnauthorized(response: Response): void {
  if (response.status !== 401 || !AUTH_ENABLED || typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/register")) return;
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.href = `/login?next=${next}`;
}

/**
 * 发起带认证 Cookie 的 JSON 请求。
 *
 * 输入：
 *   path: 后端 API 路径。
 *   init: fetch 参数。
 * 输出：返回解析后的 JSON 数据；请求失败时抛出 Error。
 */
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    redirectOnUnauthorized(response);
    throw new Error(await readErrorDetail(response, `请求失败 (${response.status})`));
  }

  return (await response.json()) as T;
}

/**
 * 发起带认证 Cookie 的原始 fetch 请求。
 *
 * 输入：
 *   path: 后端 API 路径。
 *   init: fetch 参数。
 * 输出：返回原始 Response；认证失效时会触发登录跳转。
 */
export async function requestRaw(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    credentials: "include",
    ...init
  });
  redirectOnUnauthorized(response);
  return response;
}
