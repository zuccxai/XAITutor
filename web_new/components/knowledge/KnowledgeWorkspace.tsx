"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, FolderPlus, RefreshCw, RotateCcw, Star, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useKnowledgeBases } from "@/hooks/useKnowledgeBases";
import {
  createKnowledgeBase,
  getKnowledgeUploadPolicy,
  listKnowledgeBaseFiles,
  listRagProviders,
  reindexKnowledgeBase,
  setDefaultKnowledgeBase,
  uploadKnowledgeBaseFiles
} from "@/lib/api/knowledge";
import type { KnowledgeBaseFile, KnowledgeBaseSummary, KnowledgeUploadPolicy, RagProviderSummary } from "@/lib/types/knowledge";
import { cn } from "@/lib/cn";

const fallbackProvider = "llamaindex";
const defaultPolicy: KnowledgeUploadPolicy = {
  extensions: [],
  accept: "",
  max_file_size_bytes: 100 * 1024 * 1024,
  max_pdf_size_bytes: 50 * 1024 * 1024
};

/**
 * 格式化文件大小。
 *
 * 输入：
 *   bytes: 字节数。
 * 输出：返回带单位的文件大小文本。
 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * 格式化时间值。
 *
 * 输入：
 *   value: ISO 字符串、秒级时间戳或毫秒级时间戳。
 * 输出：返回中文日期时间文本。
 */
function formatTime(value: string | number | null | undefined): string {
  if (value == null || value === "") return "-";
  const date = typeof value === "number" ? new Date(value > 10_000_000_000 ? value : value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/**
 * 判断知识库是否只读。
 *
 * 输入：
 *   kb: 知识库摘要。
 * 输出：返回当前用户是否不应对该知识库执行上传、重建等写操作。
 */
function isReadOnly(kb: KnowledgeBaseSummary): boolean {
  return Boolean(kb.read_only || kb.assigned);
}

/**
 * 生成提交给后端的知识库引用。
 *
 * 输入：
 *   kb: 知识库摘要。
 * 输出：
 *   优先返回带作用域的资源 ID，避免同名知识库跨用户或跨来源混淆。
 */
function kbResourceRef(kb: KnowledgeBaseSummary): string {
  return kb.id || kb.resource_id || kb.name;
}

/**
 * 获取知识库文档数量。
 *
 * 输入：
 *   kb: 知识库摘要。
 * 输出：返回可展示的文档数量文本。
 */
function documentCount(kb: KnowledgeBaseSummary): string {
  const stats = kb.statistics || {};
  const count = stats.raw_documents ?? stats.documents ?? stats.files;
  return typeof count === "number" ? String(count) : "-";
}

/**
 * 校验待上传文件。
 *
 * 输入：
 *   files: 用户选择的文件列表。
 *   policy: 后端上传策略。
 * 输出：返回错误信息；校验通过时返回 null。
 */
function validateFiles(files: File[], policy: KnowledgeUploadPolicy): string | null {
  if (!files.length) return "请选择至少一个文档。";
  const allowed = new Set(policy.extensions.map((item) => item.toLowerCase()));
  for (const file of files) {
    const extension = `.${file.name.split(".").pop() || ""}`.toLowerCase();
    if (allowed.size && !allowed.has(extension)) return `不支持的文件类型：${file.name}`;
    const maxSize = extension === ".pdf" ? policy.max_pdf_size_bytes : policy.max_file_size_bytes;
    if (file.size > maxSize) return `${file.name} 超过大小限制 ${formatBytes(maxSize)}。`;
  }
  return null;
}

/**
 * 构建可选 RAG provider 列表。
 *
 * 输入：
 *   providers: 后端返回的 provider 列表。
 * 输出：返回可用于下拉框的 provider 列表；为空时给出默认值。
 */
function providerOptions(providers: RagProviderSummary[]): RagProviderSummary[] {
  return providers.length
    ? providers
    : [{ id: fallbackProvider, name: "LlamaIndex", description: "默认 RAG provider" }];
}

/**
 * 格式化后端任务提示。
 *
 * 输入：
 *   message: 后端返回的任务说明。
 *   taskId: 后端任务 ID。
 * 输出：返回适合展示的任务提示文本。
 */
function taskMessage(message: string | undefined, taskId: string | undefined): string {
  return [message || "任务已提交，后端将继续处理文档。", taskId ? `任务 ID：${taskId}` : ""]
    .filter(Boolean)
    .join(" ");
}

/**
 * 渲染文件选择控件。
 *
 * 输入：
 *   files: 当前选择的文件。
 *   policy: 后端上传策略。
 *   disabled: 是否禁用。
 *   onChangeAction: 文件选择变更回调。
 * 输出：返回文件选择 UI。
 */
function FilePicker({
  files,
  policy,
  disabled,
  onChangeAction
}: {
  files: File[];
  policy: KnowledgeUploadPolicy;
  disabled?: boolean;
  onChangeAction: (files: File[]) => void;
}) {
  const validation = validateFiles(files, policy);

  return (
    <div className="space-y-2">
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-borderline bg-slate-50 px-4 py-4 text-center hover:bg-white">
        <Upload size={18} className="text-muted" />
        <span className="mt-2 text-sm font-medium text-ink">选择文档</span>
        <span className="mt-1 text-xs text-muted">
          {policy.extensions.length
            ? `${policy.extensions.join(" ")} · 单文件 ${formatBytes(policy.max_file_size_bytes)}`
            : "支持后端配置的文档类型"}
        </span>
        <input
          type="file"
          multiple
          disabled={disabled}
          accept={policy.accept}
          className="hidden"
          onChange={(event) => onChangeAction(Array.from(event.target.files || []))}
        />
      </label>
      {files.length ? (
        <div className="space-y-1 rounded-md border border-borderline bg-white p-2">
          {files.map((file) => (
            <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2 text-xs">
              <FileText size={13} className="text-muted" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-muted">{formatBytes(file.size)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {validation ? <div className="text-xs text-danger">{validation}</div> : null}
    </div>
  );
}

/**
 * 渲染知识库管理工作区。
 *
 * 输入：无。
 * 输出：返回知识库列表、新建知识库、上传文档、索引状态和授权只读提示。
 */
export function KnowledgeWorkspace() {
  const { items, loading, error, refresh } = useKnowledgeBases();
  const [providers, setProviders] = useState<RagProviderSummary[]>([]);
  const [policy, setPolicy] = useState<KnowledgeUploadPolicy>(defaultPolicy);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createProvider, setCreateProvider] = useState(fallbackProvider);
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedKb, setExpandedKb] = useState<string | null>(null);
  const [filesByKb, setFilesByKb] = useState<Record<string, KnowledgeBaseFile[]>>({});
  const [fileListError, setFileListError] = useState<Record<string, string>>({});

  const providerList = useMemo(() => providerOptions(providers), [providers]);
  const createValidation = validateFiles(createFiles, policy);
  const uploadValidation = validateFiles(uploadFiles, policy);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const [nextProviders, nextPolicy] = await Promise.all([listRagProviders(), getKnowledgeUploadPolicy()]);
        if (cancelled) return;
        setProviders(nextProviders);
        setPolicy(nextPolicy);
        setCreateProvider(nextProviders[0]?.id || fallbackProvider);
      } catch (err) {
        if (!cancelled) setActionError(err instanceof Error ? err.message : "加载知识库上传配置失败");
      }
    }
    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    const trimmedName = createName.trim();
    if (!trimmedName || createValidation) return;
    setBusy("create");
    setActionError(null);
    setNotice(null);
    try {
      const result = await createKnowledgeBase({ name: trimmedName, provider: createProvider, files: createFiles });
      setNotice(taskMessage(result.message, result.task_id));
      setShowCreate(false);
      setCreateName("");
      setCreateFiles([]);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "创建知识库失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload() {
    if (!uploadTarget || uploadValidation) return;
    setBusy(`upload:${uploadTarget}`);
    setActionError(null);
    setNotice(null);
    try {
      const result = await uploadKnowledgeBaseFiles(uploadTarget, uploadFiles);
      setNotice(taskMessage(result.message, result.task_id));
      setUploadTarget(null);
      setUploadFiles([]);
      await refresh();
      await loadFiles(uploadTarget, true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "上传文档失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleReindex(name: string) {
    setBusy(`reindex:${name}`);
    setActionError(null);
    setNotice(null);
    try {
      const result = await reindexKnowledgeBase(name);
      setNotice(taskMessage(result.message, result.task_id));
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "重建索引失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleSetDefault(name: string) {
    setBusy(`default:${name}`);
    setActionError(null);
    setNotice(null);
    try {
      await setDefaultKnowledgeBase(name);
      setNotice(`已将 ${name} 设置为默认知识库。`);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "设置默认知识库失败");
    } finally {
      setBusy(null);
    }
  }

  async function loadFiles(name: string, force = false) {
    if (!force && filesByKb[name]) return;
    setFileListError((current) => ({ ...current, [name]: "" }));
    try {
      const files = await listKnowledgeBaseFiles(name);
      setFilesByKb((current) => ({ ...current, [name]: files }));
    } catch (err) {
      setFileListError((current) => ({
        ...current,
        [name]: err instanceof Error ? err.message : "加载文档列表失败"
      }));
    }
  }

  async function toggleFiles(name: string) {
    const next = expandedKb === name ? null : name;
    setExpandedKb(next);
    if (next) await loadFiles(name);
  }

  return (
    <AppShell title="知识库" subtitle="创建知识库、上传文档、查看索引状态">
      <div className="h-full overflow-auto bg-page p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">知识库管理</h2>
            <p className="text-sm text-muted">管理教材、论文、讲义等文档，供学习任务检索。</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreate((current) => !current)}>
              <FolderPlus size={15} />
              新建知识库
            </Button>
            <Button onClick={() => void refresh()} disabled={loading}>
              <RefreshCw size={15} />
              刷新
            </Button>
          </div>
        </div>

        {notice ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}
        {error || actionError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error || actionError}
          </div>
        ) : null}

        {showCreate ? (
          <section className="mb-4 rounded-md border border-borderline bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2 font-medium text-ink">
              <FolderPlus size={16} />
              新建知识库
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
              <label>
                <span className="mb-1 block text-xs font-medium text-muted">知识库名称</span>
                <input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  className="h-9 w-full rounded-md border border-borderline bg-white px-3 text-sm outline-none focus:border-accent"
                  placeholder="例如：linear-algebra-notes"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-muted">RAG provider</span>
                <select
                  value={createProvider}
                  onChange={(event) => setCreateProvider(event.target.value)}
                  className="h-9 w-full rounded-md border border-borderline bg-white px-3 text-sm outline-none focus:border-accent"
                >
                  {providerList.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name || provider.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4">
              <FilePicker files={createFiles} policy={policy} disabled={busy === "create"} onChangeAction={setCreateFiles} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={busy === "create"}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleCreate()}
                disabled={!createName.trim() || Boolean(createValidation) || busy === "create"}
              >
                <FolderPlus size={15} />
                {busy === "create" ? "创建中..." : "创建"}
              </Button>
            </div>
          </section>
        ) : null}

        <div className="overflow-hidden rounded-md border border-borderline bg-white shadow-panel">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-borderline bg-slate-50 text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">来源</th>
                <th className="px-4 py-3 font-medium">文档数</th>
                <th className="px-4 py-3 font-medium">最近索引</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((kb) => {
                const readOnly = isReadOnly(kb);
                const kbRef = kbResourceRef(kb);
                return (
                  <Fragment key={kbRef}>
                    <tr className="border-b border-borderline last:border-0">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 font-medium text-ink hover:text-accent"
                          onClick={() => void toggleFiles(kbRef)}
                        >
                          <ChevronDown size={15} className={cn("transition-transform", expandedKb !== kbRef && "-rotate-90")} />
                          {kb.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={kb.status === "ready" ? "success" : kb.status === "error" ? "danger" : "neutral"}>
                          {kb.status || "unknown"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {readOnly ? <Badge tone="info">授权只读</Badge> : kb.is_default ? <Badge tone="success">默认</Badge> : "-"}
                      </td>
                      <td className="px-4 py-3 text-muted">{documentCount(kb)}</td>
                      <td className="px-4 py-3 text-muted">{formatTime(kb.statistics?.last_indexed_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {!kb.is_default && !readOnly ? (
                            <Button
                              variant="ghost"
                              onClick={() => void handleSetDefault(kbRef)}
                              disabled={busy === `default:${kbRef}`}
                            >
                              <Star size={14} />
                              设为默认
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setUploadTarget(kbRef);
                              setUploadFiles([]);
                            }}
                            disabled={readOnly}
                            title={readOnly ? "授权知识库为只读，不能上传文档" : "上传文档"}
                          >
                            <Upload size={14} />
                            上传文档
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => void handleReindex(kbRef)}
                            disabled={readOnly || busy === `reindex:${kbRef}`}
                            title={readOnly ? "授权知识库为只读，不能重建索引" : "重建索引"}
                          >
                            <RotateCcw size={14} />
                            重建索引
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedKb === kbRef ? (
                      <tr className="border-b border-borderline bg-slate-50/60">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="rounded-md border border-borderline bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-sm font-medium">文档列表</div>
                              <Button variant="ghost" onClick={() => void loadFiles(kbRef, true)}>
                                <RefreshCw size={13} />
                                刷新文档
                              </Button>
                            </div>
                            {fileListError[kbRef] ? (
                              <div className="text-sm text-muted">无法读取文档列表：{fileListError[kbRef]}</div>
                            ) : filesByKb[kbRef]?.length ? (
                              <div className="space-y-1">
                                {filesByKb[kbRef].map((file) => (
                                  <div key={file.name} className="flex items-center gap-3 rounded bg-slate-50 px-3 py-2 text-xs">
                                    <FileText size={14} className="text-muted" />
                                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                    <span className="text-muted">{formatBytes(file.size)}</span>
                                    <span className="text-muted">{formatTime(file.modified)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted">暂无文档或正在加载。</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {uploadTarget === kbRef && !readOnly ? (
                      <tr className="border-b border-borderline bg-blue-50/40">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="rounded-md border border-blue-100 bg-white p-4">
                            <div className="mb-3 flex items-center gap-2 font-medium">
                              <Upload size={16} />
                              上传文档到 {kb.name}
                            </div>
                            <FilePicker
                              files={uploadFiles}
                              policy={policy}
                              disabled={busy === `upload:${kbRef}`}
                              onChangeAction={setUploadFiles}
                            />
                            <div className="mt-4 flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setUploadTarget(null);
                                  setUploadFiles([]);
                                }}
                                disabled={busy === `upload:${kbRef}`}
                              >
                                取消
                              </Button>
                              <Button
                                variant="primary"
                                onClick={() => void handleUpload()}
                                disabled={Boolean(uploadValidation) || busy === `upload:${kbRef}`}
                              >
                                <Upload size={15} />
                                {busy === `upload:${kbRef}` ? "上传中..." : "上传"}
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {!items.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={6}>
                    {loading ? "加载中..." : "暂无知识库。"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
