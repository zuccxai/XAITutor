"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAuthStatus } from "@/lib/api/auth";
import { AUTH_ENABLED } from "@/lib/config";
import { cn } from "@/lib/cn";

/**
 * 渲染管理员入口。
 *
 * 输入：
 *   className: 可选样式类名。
 * 输出：当前用户为管理员时返回管理入口，否则不渲染。
 */
export function AdminLink({ className }: { className?: string }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!AUTH_ENABLED) return;
    let cancelled = false;
    fetchAuthStatus().then((status) => {
      if (!cancelled) setIsAdmin(Boolean(status?.is_admin || status?.role === "admin"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!AUTH_ENABLED || !isAdmin) return null;

  return (
    <Link
      href="/admin/users"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted",
        "transition hover:bg-slate-100 hover:text-ink",
        className
      )}
      title="用户管理"
    >
      <Shield size={14} />
      <span className="hidden sm:inline">管理</span>
    </Link>
  );
}
