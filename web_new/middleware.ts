import { NextRequest, NextResponse } from "next/server";

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
const LOGIN_PATH = "/login";
const ADMIN_PATH = "/admin";

type AuthStatus = {
  enabled?: boolean;
  authenticated?: boolean;
  role?: string | null;
  is_admin?: boolean;
};

function backendBase(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const fallback = req.nextUrl.clone();
  fallback.pathname = "";
  fallback.search = "";
  fallback.port = process.env.NEXT_PUBLIC_API_PORT || "8001";
  return fallback.toString().replace(/\/+$/, "");
}

function authStatusUrl(req: NextRequest): string {
  return `${backendBase(req)}/api/v1/auth/status`;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith(LOGIN_PATH) ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  );
}

function isAdmin(status: AuthStatus | null): boolean {
  return Boolean(status?.is_admin || status?.role === "admin");
}

function redirectToLogin(req: NextRequest): NextResponse {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function redirectToHome(req: NextRequest): NextResponse {
  const homeUrl = req.nextUrl.clone();
  homeUrl.pathname = "/";
  homeUrl.search = "";
  return NextResponse.redirect(homeUrl);
}

async function fetchAuthStatus(req: NextRequest): Promise<AuthStatus | null> {
  try {
    const response = await fetch(authStatusUrl(req), {
      cache: "no-store",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as AuthStatus;
  } catch {
    return null;
  }
}

/**
 * 在认证开启时保护 web_new 页面路由，并在进入管理路由前校验管理员角色。
 *
 * 输入：
 *   req: Next.js 中间件请求对象。
 * 输出：
 *   返回继续访问，或跳转到登录页/首页的响应。
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const status = await fetchAuthStatus(req);
  const authEnabled = status?.enabled ?? AUTH_ENABLED;

  if (!authEnabled) return NextResponse.next();

  if (!status?.authenticated) {
    return redirectToLogin(req);
  }

  if (pathname.startsWith(ADMIN_PATH) && !isAdmin(status)) {
    return redirectToHome(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
