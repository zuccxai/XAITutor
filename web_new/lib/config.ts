const DEFAULT_API_BASE = "http://localhost:8001";
export const DEFAULT_LANGUAGE = "zh";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

let warnedAboutHostSwap = false;

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE || DEFAULT_API_BASE;
}

function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

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
    // 非标准 URL 时保持原值。
  }
  return base;
}

export function apiUrl(path: string): string {
  const base = resolveBase().replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

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
