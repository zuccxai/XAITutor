"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  BookOpen,
  Brain,
  Eraser,
  Eye,
  Pencil,
  RefreshCw,
  Save,
  User
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  clearMemory,
  getMemory,
  refreshMemory,
  updateMemory
} from "@/lib/api/memory";
import { DEFAULT_LANGUAGE } from "@/lib/config";
import type { MemoryData, MemoryFile } from "@/lib/types/memory";
import { cn } from "@/lib/cn";

const emptyMemory: MemoryData = {
  summary: "",
  profile: "",
  summary_updated_at: null,
  profile_updated_at: null
};

const tabs: {
  key: MemoryFile;
  label: string;
  icon: typeof BookOpen;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: "summary",
    label: "学习摘要",
    icon: BookOpen,
    hint: "长期记录学习过程、近期主题和关键进展，会在对话后自动更新。",
    placeholder: "可以手动记录课程进度、近期困惑、已经掌握的主题..."
  },
  {
    key: "profile",
    label: "学习画像",
    icon: User,
    hint: "记录学习偏好、基础水平、常见薄弱点和个性化辅导线索。",
    placeholder: "可以手动记录学习目标、偏好的讲解方式、知识水平..."
  }
];

/**
 * 格式化记忆更新时间。
 *
 * 输入：
 *   value: 后端返回的 ISO 时间字符串。
 * 输出：
 *   返回中文日期时间；没有时间时返回未更新提示。
 */
function formatUpdatedAt(value: string | null): string {
  if (!value) return "尚未更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/**
 * 渲染长期记忆管理面板。
 *
 * 输入：
 *   无。
 * 输出：
 *   返回可编辑、预览、刷新和清空的记忆面板。
 */
export function MemoryPanel() {
  const [data, setData] = useState<MemoryData>(emptyMemory);
  const [editors, setEditors] = useState<Record<MemoryFile, string>>({
    summary: "",
    profile: ""
  });
  const [activeTab, setActiveTab] = useState<MemoryFile>("summary");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "refresh" | "clear" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const tab = useMemo(
    () => tabs.find((item) => item.key === activeTab) || tabs[0],
    [activeTab]
  );
  const editorValue = editors[activeTab];
  const hasChanges = editorValue !== data[activeTab];
  const updatedAt = data[`${activeTab}_updated_at`];

  /**
   * 加载长期记忆。
   *
   * 输入：
   *   无。
   * 输出：
   *   无；更新面板中的记忆内容。
   */
  const loadMemory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await getMemory();
      setData(next);
      setEditors({
        summary: next.summary || "",
        profile: next.profile || ""
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载记忆失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /**
   * 保存当前标签页的记忆。
   *
   * 输入：
   *   无。
   * 输出：
   *   无；调用后端保存并刷新本地快照。
   */
  async function handleSave() {
    setBusy("save");
    setError("");
    try {
      const next = await updateMemory({
        file: activeTab,
        content: editorValue
      });
      setData(next);
      setEditors((current) => ({
        ...current,
        [activeTab]: next[activeTab] || ""
      }));
      setNotice(`${tab.label}已保存。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存记忆失败");
    } finally {
      setBusy(null);
    }
  }

  /**
   * 从最近会话刷新长期记忆。
   *
   * 输入：
   *   无。
   * 输出：
   *   无；调用后端刷新摘要和画像。
   */
  async function handleRefresh() {
    setBusy("refresh");
    setError("");
    try {
      const next = await refreshMemory({ language: DEFAULT_LANGUAGE });
      setData(next);
      setEditors({
        summary: next.summary || "",
        profile: next.profile || ""
      });
      setNotice(
        next.changed === false
          ? "已检查，暂无长期记忆更新。"
          : "已从最近会话刷新记忆。"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新记忆失败");
    } finally {
      setBusy(null);
    }
  }

  /**
   * 清空当前标签页的记忆。
   *
   * 输入：
   *   无。
   * 输出：
   *   无；确认后清空后端对应记忆文件。
   */
  async function handleClear() {
    if (!window.confirm(`确认清空${tab.label}？`)) return;
    setBusy("clear");
    setError("");
    try {
      const next = await clearMemory({ file: activeTab });
      setData(next);
      setEditors((current) => ({
        ...current,
        [activeTab]: next[activeTab] || ""
      }));
      setNotice(`${tab.label}已清空。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空记忆失败");
    } finally {
      setBusy(null);
    }
  }

  /**
   * 处理编辑器快捷键。
   *
   * 输入：
   *   event: 文本域键盘事件。
   * 输出：
   *   无；Ctrl/Cmd+S 时触发保存。
   */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void handleSave();
    }
  }

  return (
    <section className="mt-6 rounded-md border border-borderline bg-white p-4 shadow-panel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">记忆</h2>
            <Badge tone={hasChanges ? "warning" : "success"}>
              {hasChanges ? "有未保存修改" : "已保存"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            记录学习摘要和学习画像，供后续学习对话持续参考。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleSave()}
            disabled={busy === "save" || loading}
          >
            <Save size={15} />
            {busy === "save" ? "保存中..." : "保存"}
          </Button>
          <Button
            onClick={() => void handleRefresh()}
            disabled={busy === "refresh" || loading}
          >
            <RefreshCw size={15} />
            {busy === "refresh" ? "刷新中..." : "从最近会话刷新"}
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleClear()}
            disabled={busy === "clear" || loading}
          >
            <Eraser size={15} />
            {busy === "clear" ? "清空中..." : "清空当前项"}
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-borderline pb-3">
        <div className="flex flex-wrap gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-secondary font-medium text-ink"
                    : "text-muted hover:bg-slate-50 hover:text-ink"
                )}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">更新：{formatUpdatedAt(updatedAt)}</span>
          <div className="flex rounded-md border border-borderline bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setView("edit")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs",
                view === "edit" ? "bg-white text-ink shadow-sm" : "text-muted"
              )}
            >
              <Pencil size={13} />
              编辑
            </button>
            <button
              type="button"
              onClick={() => setView("preview")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs",
                view === "preview" ? "bg-white text-ink shadow-sm" : "text-muted"
              )}
            >
              <Eye size={13} />
              预览
            </button>
          </div>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted">{tab.hint}</p>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center text-sm text-muted">
          记忆加载中...
        </div>
      ) : view === "edit" ? (
        <div>
          <textarea
            value={editorValue}
            onChange={(event) =>
              setEditors((current) => ({
                ...current,
                [activeTab]: event.target.value
              }))
            }
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="min-h-[320px] w-full resize-y rounded-md border border-borderline bg-white px-4 py-3 font-mono text-sm leading-7 outline-none focus:border-accent"
            placeholder={tab.placeholder}
          />
          <div className="mt-2 text-xs text-muted">
            支持 Markdown，按 Ctrl/Cmd+S 可保存。
          </div>
        </div>
      ) : editorValue.trim() ? (
        <div className="min-h-[260px] rounded-md border border-borderline bg-slate-50 px-5 py-4">
          <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:whitespace-pre-wrap">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{editorValue}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-md border border-dashed border-borderline text-center">
          <Brain size={22} className="text-muted" />
          <div className="mt-3 text-sm font-medium text-ink">暂无{tab.label}</div>
          <div className="mt-1 text-sm text-muted">
            可以从最近会话刷新，也可以直接手动编辑。
          </div>
        </div>
      )}
    </section>
  );
}
