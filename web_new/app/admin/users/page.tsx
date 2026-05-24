"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Shield, ShieldOff, SlidersHorizontal, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GrantEditor } from "@/features/multi-user/components/GrantEditor";
import { createUser, deleteUser, listUsers, setUserRole, type UserRecord } from "@/lib/api/admin";
import { fetchAuthStatus } from "@/lib/api/auth";

/**
 * 格式化用户创建时间。
 *
 * 输入：
 *   iso: 后端返回的 ISO 时间字符串。
 * 输出：返回本地化日期文本。
 */
function formatDate(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    return "-";
  }
}

/**
 * 渲染管理员用户管理页。
 *
 * 输入：无。
 * 输出：返回用户列表、角色管理和资源授权界面。
 */
export default function AdminUsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载用户失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus().then((status) => {
      if (!status?.authenticated) {
        router.replace("/login");
        return;
      }
      if (!status.is_admin && status.role !== "admin") {
        router.replace("/");
        return;
      }
      setCurrentUser(status.username || null);
      void load();
    });
  }, [load, router]);

  /**
   * 创建用户。
   *
   * 输入：
   *   event: 表单提交事件。
   * 输出：无；成功后刷新用户列表。
   */
  async function handleCreateSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (createSubmitting) return;
    setCreateError("");
    const username = createUsername.trim();
    if (!username) {
      setCreateError("请输入用户名");
      return;
    }
    if (createPassword.length < 8) {
      setCreateError("密码至少需要 8 个字符");
      return;
    }
    setCreateSubmitting(true);
    try {
      await createUser(username, createPassword);
      setShowCreateDialog(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "创建用户失败");
    } finally {
      setCreateSubmitting(false);
    }
  }

  /**
   * 删除用户。
   *
   * 输入：
   *   username: 目标用户名。
   * 输出：无；成功后从本地列表移除。
   */
  async function handleDelete(username: string) {
    if (!window.confirm(`确认删除用户「${username}」？此操作不可恢复。`)) return;
    setActionError("");
    try {
      await deleteUser(username);
      setUsers((current) => current.filter((user) => user.username !== username));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "删除用户失败");
    }
  }

  /**
   * 切换用户角色。
   *
   * 输入：
   *   user: 目标用户。
   * 输出：无；成功后更新本地角色状态。
   */
  async function handleToggleRole(user: UserRecord) {
    const nextRole = user.role === "admin" ? "user" : "admin";
    if (!window.confirm(`确认将「${user.username}」设置为 ${nextRole}？`)) return;
    setActionError("");
    try {
      await setUserRole(user.username, nextRole);
      setUsers((current) =>
        current.map((item) => (item.username === user.username ? { ...item, role: nextRole } : item))
      );
      if (nextRole === "admin") {
        setExpandedUserId((current) => (current === user.id ? null : current));
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "更新角色失败");
    }
  }

  return (
    <main className="h-screen overflow-y-auto bg-page px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} />
            返回工作台
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-ink">用户管理</h1>
            <p className="mt-1 text-sm text-muted">创建用户、切换角色，并为普通用户分配学习资源。</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus size={15} />
            新建用户
          </Button>
          <Button onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            刷新
          </Button>
        </div>

        {actionError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-danger">
            {actionError}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-md border border-borderline bg-white shadow-panel">
          {loading ? (
            <div className="py-14 text-center text-sm text-muted">正在加载用户...</div>
          ) : error ? (
            <div className="py-14 text-center text-sm text-danger">{error}</div>
          ) : users.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted">暂无用户</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borderline bg-slate-50 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">用户</th>
                  <th className="px-4 py-3 font-medium">角色</th>
                  <th className="px-4 py-3 font-medium">创建时间</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.username === currentUser;
                  const isAdmin = user.role === "admin";
                  const canAssign = !isAdmin && Boolean(user.id);
                  return (
                    <Fragment key={user.username}>
                      <tr className="border-b border-borderline last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-ink">
                          {user.username}
                          {isSelf ? <span className="ml-2 text-xs text-muted">我</span> : null}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={isAdmin ? "info" : "neutral"}>{isAdmin ? "管理员" : "用户"}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDate(user.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {canAssign ? (
                              <Button
                                variant="ghost"
                                className="size-8 p-0"
                                title="资源授权"
                                aria-label="资源授权"
                                onClick={() => setExpandedUserId((current) => (current === user.id ? null : user.id))}
                              >
                                <SlidersHorizontal size={15} />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              className="size-8 p-0"
                              disabled={isSelf}
                              title={isAdmin ? "降为普通用户" : "设为管理员"}
                              aria-label={isAdmin ? "降为普通用户" : "设为管理员"}
                              onClick={() => void handleToggleRole(user)}
                            >
                              {isAdmin ? <ShieldOff size={15} /> : <Shield size={15} />}
                            </Button>
                            <Button
                              variant="ghost"
                              className="size-8 p-0 text-danger hover:bg-red-50"
                              disabled={isSelf}
                              title="删除用户"
                              aria-label="删除用户"
                              onClick={() => void handleDelete(user.username)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {canAssign && expandedUserId === user.id ? (
                        <tr>
                          <td colSpan={4} className="p-0">
                            <GrantEditor userId={user.id} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreateDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !createSubmitting && setShowCreateDialog(false)}
        >
          <form
            className="w-full max-w-sm rounded-md border border-borderline bg-white p-5 shadow-panel"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreateSubmit}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">新建用户</h2>
              <button
                type="button"
                className="rounded-md p-1 text-muted hover:bg-slate-100 hover:text-ink"
                onClick={() => setShowCreateDialog(false)}
                disabled={createSubmitting}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">用户名或邮箱</span>
              <input
                value={createUsername}
                onChange={(event) => setCreateUsername(event.target.value)}
                className="h-9 w-full rounded-md border border-borderline px-3 text-sm outline-none focus:border-accent"
                autoFocus
              />
            </label>
            <label className="mb-4 block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">初始密码</span>
              <input
                type="password"
                value={createPassword}
                onChange={(event) => setCreatePassword(event.target.value)}
                className="h-9 w-full rounded-md border border-borderline px-3 text-sm outline-none focus:border-accent"
              />
            </label>
            {createError ? <div className="mb-3 text-sm text-danger">{createError}</div> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreateDialog(false)} disabled={createSubmitting}>
                取消
              </Button>
              <Button type="submit" variant="primary" disabled={createSubmitting}>
                创建
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
