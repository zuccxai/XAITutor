"use client";

import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  RefreshCw,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import type { HistoryEntry } from "@/hooks/useKnowledgeHistory";

interface KbUpdateHistoryProps {
  entries: HistoryEntry[];
  onClear: () => void;
}

export default function KbUpdateHistory({
  entries,
  onClear,
}: KbUpdateHistoryProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          <History className="h-3 w-3" />
          {t("Update history")}
          <span className="rounded-full bg-[var(--muted)] px-1.5 py-0 text-[10px] tracking-normal">
            {entries.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          title={t("Clear history")}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label={t("Clear history")}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
        {entries.map((entry) => {
          const expanded = expandedId === entry.id;
          const isError = entry.status === "error";
          const Icon = iconForKind(entry.kind);
          const durationMs = Math.max(0, entry.completedAt - entry.startedAt);

          return (
            <li key={entry.id} className="text-[12.5px]">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : entry.id)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--muted)]/40"
              >
                <span className="mt-0.5 shrink-0 text-[var(--muted-foreground)]">
                  {expanded ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )}
                </span>

                <span
                  className={`mt-0.5 shrink-0 rounded-md p-1 ${
                    isError
                      ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  }`}
                >
                  {isError ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--foreground)]">
                    <Icon className="h-3 w-3 text-[var(--muted-foreground)]" />
                    {formatHistoryLabel(entry.label, t)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">
                    {new Date(entry.completedAt).toLocaleString(t("locale.date"))}
                    {durationMs > 0 && ` · ${formatDuration(durationMs, t)}`}
                  </span>
                </span>
              </button>

              {expanded && (
                <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
                  {entry.error && (
                    <pre className="mb-2 whitespace-pre-wrap break-words rounded-md border border-red-200 bg-red-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      {entry.error}
                    </pre>
                  )}
                  {entry.logTail.length > 0 ? (
                    <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 font-mono text-[10.5px] leading-relaxed text-[var(--muted-foreground)]">
                      {entry.logTail.join("\n")}
                    </pre>
                  ) : (
                    !entry.error && (
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {t("No logs captured.")}
                      </p>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function iconForKind(kind: HistoryEntry["kind"]) {
  switch (kind) {
    case "upload":
      return Upload;
    case "reindex":
      return RefreshCw;
    case "create":
    default:
      return Wand2;
  }
}

// 输入：历史任务原始标签和翻译函数；输出：用于历史记录展示的本地化任务标签。
function formatHistoryLabel(label: string, t: TFunction): string {
  if (label.startsWith("Create ")) {
    return t("Create {{name}}", { name: label.slice("Create ".length) });
  }
  if (label.startsWith("Upload to ")) {
    return t("Upload to {{name}}", { name: label.slice("Upload to ".length) });
  }
  if (label.startsWith("Re-index ")) {
    return t("Re-index {{name}}", { name: label.slice("Re-index ".length) });
  }
  return label;
}

// 输入：任务耗时毫秒数和翻译函数；输出：用于历史记录展示的本地化耗时。
function formatDuration(ms: number, t: TFunction): string {
  if (ms < 1000) return t("{{count}} ms", { count: ms });
  if (ms < 60_000) {
    return t("{{count}} seconds", {
      count: Number((ms / 1000).toFixed(1)),
    });
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return t("{{minutes}} min {{seconds}} sec", { minutes, seconds });
}
