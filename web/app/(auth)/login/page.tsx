"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { checkIsFirstUser, fetchAuthStatus, login } from "@/lib/auth";

/**
 * 渲染登录页主体。
 *
 * 输入：无。
 * 输出：返回登录表单，登录成功后跳转到 next 指定页面。
 */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const registered = searchParams.get("registered") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchAuthStatus().then((status) => {
      if (cancelled) return;
      if (status?.authenticated) {
        router.replace(next);
        return;
      }

      checkIsFirstUser().then((first) => {
        if (!cancelled && first) router.replace("/register");
      });
    });

    return () => {
      cancelled = true;
    };
  }, [router, next]);

  /**
   * 提交登录表单。
   *
   * 输入：
   *   event: 表单提交事件。
   * 输出：无；登录成功后跳转，失败时展示错误信息。
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("请输入用户名或邮箱和密码");
      return;
    }

    setLoading(true);
    const result = await login(username.trim(), password);
    if (result.ok) {
      router.replace(next);
      return;
    }

    setError(result.error ?? "登录失败");
    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          DeepTutor
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          登录你的学习账户
        </p>
      </div>

      {registered ? (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          账户已创建，请登录继续。
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-8 py-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block" htmlFor="username">
            <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              用户名或邮箱
            </span>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-shadow placeholder:text-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="admin 或 you@example.com"
            />
          </label>

          <label className="block" htmlFor="password">
            <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              密码
            </span>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-shadow placeholder:text-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="请输入密码"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {loading ? "正在登录..." : "登录"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        还没有账户？{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          创建账户
        </Link>
      </p>

      <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
        DeepTutor · Agent-Native Learning
      </p>
    </div>
  );
}

/**
 * 渲染登录页。
 *
 * 输入：无。
 * 输出：返回带 Suspense 的登录页面。
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-sm text-center text-sm text-[var(--muted-foreground)]">
          正在加载登录页...
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
