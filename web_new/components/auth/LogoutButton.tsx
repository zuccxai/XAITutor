"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/api/auth";
import { AUTH_ENABLED } from "@/lib/config";
import { cn } from "@/lib/cn";

/**
 * 渲染注销按钮。
 *
 * 输入：
 *   className: 可选样式类名。
 * 输出：返回注销按钮；未开启认证时不渲染。
 */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  if (!AUTH_ENABLED) return null;

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted",
        "transition hover:bg-slate-100 hover:text-ink",
        className
      )}
      onClick={() => void handleLogout()}
      title="退出登录"
      aria-label="退出登录"
    >
      <LogOut size={14} />
      <span className="hidden sm:inline">退出</span>
    </button>
  );
}
