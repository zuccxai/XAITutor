"use client";

import { AdminLink } from "@/components/auth/AdminLink";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Badge } from "@/components/ui/Badge";

/**
 * 渲染顶部栏。
 *
 * 输入：
 *   title: 页面标题。
 *   subtitle: 页面副标题。
 *   status: 可选连接状态。
 * 输出：返回包含状态、管理员入口和退出按钮的顶栏。
 */
export function TopBar({
  title,
  subtitle,
  status
}: {
  title: string;
  subtitle?: string;
  status?: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-borderline bg-white px-5">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {status ? (
          <Badge tone={status === "connected" ? "success" : "neutral"}>{status}</Badge>
        ) : null}
        <AdminLink />
        <LogoutButton />
      </div>
    </header>
  );
}
