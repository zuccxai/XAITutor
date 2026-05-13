"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Camera,
  ChevronDown,
  GraduationCap,
  Library,
  Pencil,
  Plus,
  NotebookPen,
  Trophy,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/cn";
import { fromBackendCapability } from "@/lib/capabilities";
import {
  deleteSession,
  listSessions,
  renameSession
} from "@/lib/api/sessions";
import type { CapabilityName } from "@/lib/types/chat";
import type { SessionSummary } from "@/lib/types/session";

type HistoryGroup = {
  id: CapabilityName;
  label: string;
};

const items = [
  {
    href: "/daily-practice",
    label: "日常练习",
    icon: NotebookPen,
    capability: null
  },
  { href: "/photo-solve", label: "拍照解题", icon: Camera, capability: null },
  {
    href: "/competition-assistant",
    label: "备赛助手",
    icon: Trophy,
    capability: null
  },
  { href: "/knowledge", label: "知识库", icon: Library, capability: null },
  { href: "/memory", label: "记忆", icon: BookOpen, capability: null }
] as const;

export type SidebarHistoryProps = {
  activeSessionId?: string | null;
  currentCapability?: CapabilityName;
  refreshToken?: number;
  onSelectSession?: (sessionId: string) => void | Promise<void>;
  onNewSession?: (capability: CapabilityName) => void;
};

const historyGroups: HistoryGroup[] = [
  { id: "deep_solve", label: "深度解题" },
  { id: "deep_guided", label: "深度引导" },
  { id: "photo_solve", label: "拍照解题" },
  { id: "competition_consulting", label: "备赛助手" }
];

/**
 * 根据后端记录标识推断前端学习记录分组。
 *
 * 输入：
 *   session: 后端返回的会话摘要。
 * 输出：
 *   返回当前记录所属的前端分组；无法识别时返回学习分组。
 */
function sessionHistoryGroup(session: SessionSummary): CapabilityName {
  const capability = session.preferences?.capability;
  if (
    capability === "competition_assistant" ||
    capability === "competition-assistant"
  ) {
    return "competition_consulting";
  }
  return fromBackendCapability(capability);
}

/**
 * 按能力分组学习记录。
 *
 * 输入：
 *   sessions: 后端返回的会话摘要。
 * 输出：
 *   返回以 web_new 能力标识为键的学习记录分组。
 */
function groupSessions(
  sessions: SessionSummary[]
): Record<CapabilityName, SessionSummary[]> {
  return historyGroups.reduce(
    (groups, group) => {
      groups[group.id] = sessions.filter(
        (session) => sessionHistoryGroup(session) === group.id
      );
      return groups;
    },
    {} as Record<CapabilityName, SessionSummary[]>
  );
}

/**
 * 获取学习记录标题。
 *
 * 输入：
 *   session: 会话摘要。
 * 输出：
 *   返回可展示的学习记录标题。
 */
function sessionTitle(session: SessionSummary): string {
  return session.title || session.last_message || "未命名学习记录";
}

/**
 * 格式化会话更新时间。
 *
 * 输入：
 *   value: 后端返回的秒级或毫秒级时间戳。
 * 输出：
 *   返回中文月日时分文本。
 */
function formatUpdatedAt(value: number): string {
  const timestamp = value > 10_000_000_000 ? value : value * 1000;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

/**
 * 构建学习记录分组展开状态。
 *
 * 输入：
 *   activeCapability: 当前选中的能力。
 * 输出：
 *   返回仅当前能力默认展开的状态对象。
 */
function openGroupsForCapability(
  activeCapability: CapabilityName | undefined
): Record<CapabilityName, boolean> {
  return {
    chat: activeCapability === "chat",
    deep_solve: activeCapability === "deep_solve",
    deep_question: activeCapability === "deep_question",
    deep_guided: activeCapability === "deep_guided",
    photo_solve: activeCapability === "photo_solve",
    competition_consulting: activeCapability === "competition_consulting"
  };
}

/**
 * 获取新学习默认进入的能力和页面。
 *
 * 输入：
 *   activeCapability: 当前页面正在使用的能力。
 * 输出：
 *   返回新学习应创建的能力和跳转页面。
 */
function newLearningTarget(activeCapability: CapabilityName | undefined): {
  capability: CapabilityName;
  href: string;
} {
  if (activeCapability === "deep_guided") {
    return { capability: "deep_guided", href: "/daily-practice" };
  }
  if (activeCapability === "photo_solve") {
    return { capability: "photo_solve", href: "/photo-solve" };
  }
  if (activeCapability === "competition_consulting") {
    return {
      capability: "competition_consulting",
      href: "/competition-assistant"
    };
  }
  return { capability: "deep_solve", href: "/daily-practice" };
}

/**
 * 渲染学习记录面板。
 *
 * 输入：
 *   history: 学习记录加载、选择和新建回调。
 * 输出：
 *   返回按能力分组的学习记录列表。
 */
function HistoryPanel({ history }: { history: SidebarHistoryProps }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<CapabilityName, boolean>>(
    () => openGroupsForCapability(history.currentCapability)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 刷新学习记录列表。
   *
   * 输入：
   *   无。
   * 输出：
   *   无；通过组件状态保存加载到的学习记录。
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await listSessions(80, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载学习记录失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [history.refreshToken, refresh]);

  useEffect(() => {
    setOpenGroups(openGroupsForCapability(history.currentCapability));
  }, [history.currentCapability]);

  const groups = useMemo(() => groupSessions(sessions), [sessions]);

  /**
   * 重命名指定学习记录。
   *
   * 输入：
   *   session: 要重命名的会话摘要。
   * 输出：
   *   无；成功后刷新本地学习记录列表。
   */
  async function handleRename(session: SessionSummary) {
    const nextTitle = window.prompt("重命名学习记录", sessionTitle(session));
    const title = nextTitle?.trim();
    if (!title || title === session.title) return;
    setError(null);
    try {
      const updated = await renameSession(session.session_id, title);
      setSessions((current) =>
        current.map((item) =>
          item.session_id === session.session_id ? { ...item, ...updated } : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "重命名学习记录失败");
    }
  }

  /**
   * 删除指定学习记录。
   *
   * 输入：
   *   session: 要删除的会话摘要。
   * 输出：
   *   无；成功后从本地学习记录列表移除该会话。
   */
  async function handleDelete(session: SessionSummary) {
    if (!window.confirm(`确认删除“${sessionTitle(session)}”？`)) return;
    setError(null);
    try {
      await deleteSession(session.session_id);
      setSessions((current) =>
        current.filter((item) => item.session_id !== session.session_id)
      );
      if (
        history.activeSessionId === session.session_id &&
        history.currentCapability
      ) {
        history.onNewSession?.(history.currentCapability);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除学习记录失败");
    }
  }

  return (
    <section className="mt-3 min-h-0 border-t border-borderline pt-3">
      <div className="px-3 text-xs font-medium text-ink">
        学习记录
      </div>
      <div className="mt-2 max-h-[48vh] overflow-y-auto px-2 pb-2 scrollbar-thin">
        {error ? (
          <div className="px-2 py-2 text-xs text-danger">{error}</div>
        ) : null}
        {historyGroups.map((group) => {
          const items = groups[group.id] || [];
          const open = openGroups[group.id];
          return (
            <div key={group.id} className="mb-1">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5",
                  "text-left text-xs font-medium text-muted hover:bg-white/60",
                  "hover:text-ink"
                )}
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.id]: !current[group.id]
                  }))
                }
              >
                <ChevronDown
                  size={13}
                  className={cn("transition-transform", !open && "-rotate-90")}
                />
                <span className="flex-1">{group.label}</span>
                <span className="text-[10px]">{items.length}</span>
              </button>
              {open ? (
                <div className="space-y-1 pl-4">
                  {items.map((session) => {
                    const active = history.activeSessionId === session.session_id;
                    return (
                      <div
                        key={session.session_id}
                        className={cn(
                          "group relative rounded-md transition hover:bg-white/70",
                          active && "bg-white/80 shadow-panel"
                        )}
                      >
                        <button
                          type="button"
                          className="block w-full rounded-md px-2 py-1.5 pr-14 text-left"
                          onClick={() =>
                            void history.onSelectSession?.(session.session_id)
                          }
                          title={sessionTitle(session)}
                        >
                          <div className="truncate text-xs font-medium text-ink">
                            {sessionTitle(session)}
                          </div>
                          <div
                            className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted"
                          >
                            <span>{formatUpdatedAt(session.updated_at)}</span>
                            <span>{session.message_count} 条</span>
                          </div>
                        </button>
                        <div
                          className="absolute right-1 top-1 hidden items-center gap-0.5 group-hover:flex"
                        >
                          <button
                            type="button"
                            className={cn(
                              "flex size-6 items-center justify-center rounded",
                              "text-muted hover:bg-white hover:text-ink"
                            )}
                            title="重命名"
                            aria-label="重命名"
                            onClick={() => void handleRename(session)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "flex size-6 items-center justify-center rounded",
                              "text-muted hover:bg-red-50 hover:text-danger"
                            )}
                            title="删除"
                            aria-label="删除"
                            onClick={() => void handleDelete(session)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!items.length ? (
                    <div className="px-2 py-1 text-[11px] text-muted">
                      暂无学习记录
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {loading && !sessions.length ? (
          <div className="px-2 py-2 text-xs text-muted">加载学习记录中...</div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * 渲染新版演示侧边栏。
 *
 * 输入：
 *   history: 可选学习记录控制参数。
 * 输出：
 *   返回主导航和预览版标识。
 */
export function Sidebar({ history }: { history?: SidebarHistoryProps }) {
  const pathname = usePathname();
  const newLearning = newLearningTarget(history?.currentCapability);
  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-borderline bg-secondary">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex size-8 items-center justify-center rounded-xl bg-accent text-white">
          <GraduationCap size={18} />
        </div>
        <div className="text-[16px] font-semibold tracking-normal text-ink">
          小海
        </div>
      </div>
      <nav className="space-y-1 px-2 pt-1">
        <Link
          href={newLearning.href}
          className={cn(
            "mb-1 flex h-9 items-center gap-2.5 rounded-lg px-3",
            "text-[13.5px] text-muted transition hover:bg-white/70 hover:text-ink"
          )}
          onClick={() => history?.onNewSession?.(newLearning.capability)}
        >
          <Plus size={16} />
          新学习
        </Link>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.capability
            ? history?.currentCapability === item.capability
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px]",
                "text-muted transition hover:bg-white/60 hover:text-ink",
                active && "bg-white/80 font-medium text-ink shadow-panel"
              )}
            >
              <Icon size={16} strokeWidth={active ? 1.9 : 1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <HistoryPanel history={history || {}} />
      <div className="mt-auto border-t border-borderline px-4 py-3 text-xs text-muted">
        <div className="flex items-center gap-2">
          <BookOpen size={14} />
          单用户版
        </div>
      </div>
    </aside>
  );
}
