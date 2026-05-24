"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { checkIsFirstUser, fetchAuthStatus, login } from "@/lib/api/auth";

/**
 * 渲染登录页主体。
 *
 * 输入：无。
 * 输出：返回登录表单，成功后跳转到 next 指定页面。
 */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
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
  }, [next, router]);

  /**
   * 提交登录表单。
   *
   * 输入：
   *   event: 表单提交事件。
   * 输出：无；登录成功后跳转，失败时展示错误。
   */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username.trim(), password);
    if (result.ok) {
      router.replace(next);
      return;
    }
    setError(result.error || "登录失败");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <section className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-white">
            <GraduationCap size={22} />
          </div>
          <h1 className="text-xl font-semibold text-ink">登录小海学习工作台</h1>
          <p className="mt-1 text-sm text-muted">继续你的个性化学习空间</p>
        </div>

        {registered ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            账号已创建，请登录继续。
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="rounded-md border border-borderline bg-white p-5 shadow-panel">
          <label className="mb-4 block text-sm">
            <span className="mb-1.5 block font-medium text-ink">用户名或邮箱</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="h-10 w-full rounded-md border border-borderline px-3 text-sm outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-1.5 block font-medium text-ink">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="h-10 w-full rounded-md border border-borderline px-3 text-sm outline-none focus:border-accent"
              placeholder="请输入密码"
            />
          </label>
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          ) : null}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {loading ? "正在登录..." : "登录"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          没有账号？{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            注册
          </Link>
        </p>
      </section>
    </main>
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
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-muted">加载中...</main>}>
      <LoginContent />
    </Suspense>
  );
}
