const DEFAULT_API_BASE = "http://localhost:8001";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export const DEFAULT_LANGUAGE = "zh";
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

let warnedAboutHostSwap = false;

/**
 * 读取构建时注入的后端 API 地址。
 *
 * 输入：无。
 * 输出：返回前端请求后端时使用的基础 URL。
 */
export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE || DEFAULT_API_BASE;
}

/**
 * 判断主机名是否指向访问端本机。
 *
 * 输入：
 *   host: URL 中解析出的主机名。
 * 输出：返回该主机名是否属于本机回环地址。
 */
function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

/**
 * 解析浏览器端实际可访问的后端基础地址。
 *
 * 输入：无。
 * 输出：返回可用于 fetch 和 WebSocket 拼接的基础地址；远程访问时会把 localhost 替换为当前页面主机。
 */
export function resolveBase(): string {
  const base = apiBaseUrl();
  if (typeof window === "undefined") return base;
  try {
    const url = new URL(base);
    const clientHost = window.location.hostname;
    if (isLoopbackHost(url.hostname) && !isLoopbackHost(clientHost)) {
      url.hostname = clientHost;
      if (!warnedAboutHostSwap) {
        warnedAboutHostSwap = true;
        console.warn(
          `[api] NEXT_PUBLIC_API_BASE 指向 "${base}"，当前页面来自 "${clientHost}"，已自动改用 "${url.toString()}"。`
        );
      }
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    // 非标准 URL 保持原值，交给调用方或浏览器处理。
  }
  return base;
}

/**
 * 拼接后端 API 完整地址。
 *
 * 输入：
 *   path: API 路径，例如 /api/v1/auth/status。
 * 输出：返回完整请求 URL。
 */
export function apiUrl(path: string): string {
  const base = resolveBase().replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/**
 * 获取统一 WebSocket 端点地址。
 *
 * 输入：无。
 * 输出：返回可直接传给 WebSocket 构造器的地址。
 */
export function wsEndpoint(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    if (typeof window === "undefined") return process.env.NEXT_PUBLIC_WS_URL;
    try {
      const url = new URL(process.env.NEXT_PUBLIC_WS_URL);
      const clientHost = window.location.hostname;
      if (isLoopbackHost(url.hostname) && !isLoopbackHost(clientHost)) {
        url.hostname = clientHost;
        return url.toString();
      }
    } catch {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  return resolveBase()
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:")
    .replace(/\/+$/, "")
    .concat("/api/v1/ws");
}
