"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { checkIsFirstUser, fetchAuthStatus, register } from "@/lib/api/auth";

/**
 * 渲染注册页。
 *
 * 输入：无。
 * 输出：返回注册表单，成功后跳转登录页。
 */
export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFirst, setIsFirst] = useState(false);
  const [checkingFirst, setCheckingFirst] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAuthStatus().then((status) => {
      if (!cancelled && status?.authenticated) router.replace("/");
    });
    checkIsFirstUser().then((first) => {
      if (!cancelled) {
        setIsFirst(first);
        setCheckingFirst(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  /**
   * 提交注册表单。
   *
   * 输入：
   *   event: 表单提交事件。
   * 输出：无；注册成功后跳转登录页，失败时展示错误。
   */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 个字符");
      return;
    }
    setLoading(true);
    const result = await register(username.trim(), password);
    if (result.ok) {
      router.replace("/login?registered=1");
      return;
    }
    setError(result.error || "注册失败");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <section className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-white">
            <GraduationCap size={22} />
          </div>
          <h1 className="text-xl font-semibold text-ink">创建学习账号</h1>
          <p className="mt-1 text-sm text-muted">为你的学习记录建立独立空间</p>
        </div>

        {!checkingFirst && isFirst ? (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            这是第一个账号，注册后会自动成为管理员。
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
              autoComplete="new-password"
              required
              className="h-10 w-full rounded-md border border-borderline px-3 text-sm outline-none focus:border-accent"
              placeholder="至少 8 个字符"
            />
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-1.5 block font-medium text-ink">确认密码</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="h-10 w-full rounded-md border border-borderline px-3 text-sm outline-none focus:border-accent"
              placeholder="再次输入密码"
            />
          </label>
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          ) : null}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {loading ? "正在创建..." : "注册"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            登录
          </Link>
        </p>
      </section>
    </main>
  );
}
