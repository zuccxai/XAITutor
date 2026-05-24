"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkIsFirstUser, fetchAuthStatus, register } from "@/lib/auth";

/**
 * 渲染注册页。
 *
 * 输入：无。
 * 输出：返回注册表单，首个账户注册成功后由后端自动授予管理员角色。
 */
export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFirst, setIsFirst] = useState(false);
  const [checkingFirst, setCheckingFirst] = useState(true);

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
   * 执行注册请求。
   *
   * 输入：无。
   * 输出：无；注册成功后跳转登录页，失败时展示错误信息。
   */
  async function submitRegister() {
    if (loading) return;
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

    setError(result.error ?? "注册失败");
    setLoading(false);
  }

  /**
   * 接管表单提交事件，阻止浏览器原生跳转到 /register?。
   *
   * 输入：
   *   event: 表单提交事件。
   * 输出：无；转交 submitRegister 执行注册请求。
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitRegister();
  }

  /**
   * 接管按钮点击事件，避免未预期的原生表单提交。
   *
   * 输入：
   *   event: 按钮点击事件。
   * 输出：无；转交 submitRegister 执行注册请求。
   */
  function handleRegisterClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    void submitRegister();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          DeepTutor
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          创建你的学习账户
        </p>
      </div>

      {!checkingFirst && isFirst ? (
        <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-600 dark:text-blue-400">
          这是第一个账户，注册后会自动成为管理员。
        </div>
      ) : null}

      {!checkingFirst && !isFirst ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          当前系统已有用户，请由管理员在用户管理页创建新账户。
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-shadow placeholder:text-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="至少 8 个字符"
            />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              密码至少 8 个字符。
            </p>
          </label>

          <label className="block" htmlFor="confirmPassword">
            <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              确认密码
            </span>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-shadow placeholder:text-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="再次输入密码"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleRegisterClick}
            disabled={loading}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "正在创建..." : "注册"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        已有账户？{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          登录
        </Link>
      </p>

      <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
        DeepTutor · Agent-Native Learning
      </p>
    </div>
  );
}
