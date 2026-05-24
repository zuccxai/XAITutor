// API 配置和工具函数。

// 从环境变量读取 API base；如果构建环境没有注入，运行时会按当前访问主机兜底。
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE || "";

// Hostnames that always refer to the local machine. When the build-time base
// URL points to one of these, but the page is opened from a non-local origin,
// we rewrite the hostname so requests reach the actual server.
const LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

let warnedAboutHostSwap = false;
let warnedAboutMissingBase = false;

function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

/**
 * 构造缺省 API base。
 *
 * 输入：无。
 * 输出：返回当前访问主机的 8001 后端地址；SSR 下返回本机默认后端地址。
 */
function fallbackBase(): string {
  if (typeof window === "undefined") return "http://localhost:8001";
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8001`;
}

/**
 * Resolve the effective API base URL at runtime.
 *
 * NEXT_PUBLIC_API_BASE is a build-time constant that is typically set to
 * http://localhost:<port>.  When another machine on the LAN opens the app that
 * constant still points at "localhost", which the remote browser resolves to
 * its *own* loopback address instead of the server.  We detect this situation
 * and swap the hostname for window.location.hostname so the request reaches
 * the actual server regardless of which machine opened the page.
 *
 * The full path/search is preserved (so deployments behind a reverse proxy
 * like `http://localhost:8001/api` continue to work after the rewrite).
 */
export function resolveBase(): string {
  const base = API_BASE_URL || fallbackBase();
  if (!API_BASE_URL && typeof window !== "undefined" && !warnedAboutMissingBase) {
    warnedAboutMissingBase = true;
    console.warn(
      `[api] NEXT_PUBLIC_API_BASE is not set; falling back to "${base}".`,
    );
  }
  if (typeof window === "undefined") return base;
  try {
    const url = new URL(base);
    const clientHost = window.location.hostname;
    if (isLoopbackHost(url.hostname) && !isLoopbackHost(clientHost)) {
      url.hostname = clientHost;
      if (!warnedAboutHostSwap) {
        warnedAboutHostSwap = true;
        console.warn(
          `[api] NEXT_PUBLIC_API_BASE points to "${base}" but the page is served from "${clientHost}"; ` +
            `routing API/WebSocket calls to "${url.toString()}" instead.`,
        );
      }
      // Use href (full URL) instead of origin so we keep any path/search.
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    // base is not a valid absolute URL – return as-is
  }
  return base;
}

/**
 * Construct a full API URL from a path
 * @param path - API path (e.g., '/api/v1/knowledge/list')
 * @returns Full URL (e.g., 'http://localhost:8001/api/v1/knowledge/list')
 */
export function apiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Remove trailing slash from base URL if present
  const base = resolveBase();
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Construct a WebSocket URL from a path
 * @param path - WebSocket path (e.g., '/api/v1/solve')
 * @returns WebSocket URL (e.g., 'ws://localhost:8001/api/v1/ws')
 */
export function wsUrl(path: string): string {
  // Security Hardening: Convert http to ws and https to wss.
  // In production environments (where API_BASE_URL starts with https), this ensures secure websockets.
  const base = resolveBase()
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:");

  // Remove leading slash if present to avoid double slashes
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Remove trailing slash from base URL if present
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  return `${normalizedBase}${normalizedPath}`;
}

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

/**
 * 从后端错误响应中提取可读错误。
 *
 * 输入：
 *   response: fetch 返回的错误响应。
 *   fallback: 无法解析时使用的默认错误文本。
 * 输出：返回可展示给用户的错误说明。
 */
async function readErrorDetail(
  response: Response,
  fallback: string,
): Promise<string> {
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
  if (response.status !== 401 || !AUTH_ENABLED || typeof window === "undefined")
    return;
  if (
    window.location.pathname.startsWith("/login") ||
    window.location.pathname.startsWith("/register")
  )
    return;
  const next = encodeURIComponent(
    `${window.location.pathname}${window.location.search}`,
  );
  window.location.href = `/login?next=${next}`;
}

/**
 * Authenticated fetch wrapper. Behaves identically to `fetch` but automatically
 * redirects to /login when the backend returns 401 (expired / invalid token).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, { credentials: "include", ...init });

  if (res.status === 401 && AUTH_ENABLED && typeof window !== "undefined") {
    redirectOnUnauthorized(res);
    return new Promise(() => {});
  }

  return res;
}

/**
 * 发起带认证 Cookie 的 JSON 请求。
 *
 * 输入：
 *   path: 后端 API 路径。
 *   init: fetch 参数。
 * 输出：返回解析后的 JSON 数据；请求失败时抛出 Error。
 */
export async function requestJson<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    redirectOnUnauthorized(response);
    throw new Error(await readErrorDetail(response, `请求失败 (${response.status})`));
  }

  return (await response.json()) as T;
}
