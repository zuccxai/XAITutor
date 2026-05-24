import { requestJson } from "@/lib/api/client";
import type {
  KnowledgeBaseFile,
  KnowledgeBaseSummary,
  KnowledgeTaskResponse,
  KnowledgeUploadPolicy,
  RagProviderSummary
} from "@/lib/types/knowledge";

interface MyAccessResponse {
  knowledge_bases?: KnowledgeBaseSummary[];
}

interface AuthStatusResponse {
  enabled?: boolean;
  authenticated?: boolean;
}

/**
 * 获取知识库列表。
 *
 * 输入：无。
 * 输出：返回当前用户可见的知识库摘要数组。
 */
export async function listKnowledgeBases(): Promise<KnowledgeBaseSummary[]> {
  const [status, accessData] = await Promise.all([
    requestJson<AuthStatusResponse>("/api/v1/auth/status").catch(() => null),
    requestJson<MyAccessResponse>("/api/v1/multi-user/me/access").catch(
      () => null
    )
  ]);
  const authEnabled = Boolean(status?.enabled);
  if (authEnabled && !status?.authenticated) {
    throw new Error("Not authenticated");
  }
  return Array.isArray(accessData?.knowledge_bases)
    ? accessData.knowledge_bases
    : [];
}

/**
 * 获取可用 RAG provider。
 *
 * 输入：无。
 * 输出：返回后端注册的 RAG provider 列表。
 */
export async function listRagProviders(): Promise<RagProviderSummary[]> {
  const data = await requestJson<{ providers?: RagProviderSummary[] }>("/api/v1/knowledge/rag-providers");
  return data.providers || [];
}

/**
 * 获取知识库上传策略。
 *
 * 输入：无。
 * 输出：返回支持扩展名、accept 和文件大小限制。
 */
export async function getKnowledgeUploadPolicy(): Promise<KnowledgeUploadPolicy> {
  const data = await requestJson<Partial<KnowledgeUploadPolicy>>("/api/v1/knowledge/supported-file-types");
  return {
    extensions: Array.isArray(data.extensions) ? data.extensions : [],
    accept: typeof data.accept === "string" ? data.accept : "",
    max_file_size_bytes:
      typeof data.max_file_size_bytes === "number" ? data.max_file_size_bytes : 100 * 1024 * 1024,
    max_pdf_size_bytes:
      typeof data.max_pdf_size_bytes === "number" ? data.max_pdf_size_bytes : 50 * 1024 * 1024
  };
}

/**
 * 新建知识库并上传初始文档。
 *
 * 输入：
 *   payload: 知识库名称、provider 和初始文件。
 * 输出：返回后端任务响应。
 */
export async function createKnowledgeBase(payload: {
  name: string;
  provider: string;
  files: File[];
}): Promise<KnowledgeTaskResponse> {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("rag_provider", payload.provider);
  payload.files.forEach((file) => form.append("files", file));
  return requestJson<KnowledgeTaskResponse>("/api/v1/knowledge/create", {
    method: "POST",
    body: form
  });
}

/**
 * 上传文档到已有知识库。
 *
 * 输入：
 *   name: 目标知识库名称或引用。
 *   files: 要上传的文件数组。
 *   provider: 可选 RAG provider。
 * 输出：返回后端任务响应。
 */
export async function uploadKnowledgeBaseFiles(
  name: string,
  files: File[],
  provider?: string
): Promise<KnowledgeTaskResponse> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  if (provider) form.append("rag_provider", provider);
  return requestJson<KnowledgeTaskResponse>(`/api/v1/knowledge/${encodeURIComponent(name)}/upload`, {
    method: "POST",
    body: form
  });
}

/**
 * 获取知识库原始文档列表。
 *
 * 输入：
 *   name: 目标知识库名称或引用。
 * 输出：返回该知识库中的文件列表。
 */
export async function listKnowledgeBaseFiles(name: string): Promise<KnowledgeBaseFile[]> {
  const data = await requestJson<{ files?: KnowledgeBaseFile[] }>(
    `/api/v1/knowledge/${encodeURIComponent(name)}/files`
  );
  return data.files || [];
}

/**
 * 设置默认知识库。
 *
 * 输入：
 *   name: 要设为默认的知识库名称或引用。
 * 输出：无；通过后端更新默认知识库。
 */
export async function setDefaultKnowledgeBase(name: string): Promise<void> {
  await requestJson(`/api/v1/knowledge/default/${encodeURIComponent(name)}`, {
    method: "PUT"
  });
}

/**
 * 重建知识库索引。
 *
 * 输入：
 *   name: 目标知识库名称或引用。
 * 输出：返回后端任务响应。
 */
export async function reindexKnowledgeBase(name: string): Promise<KnowledgeTaskResponse> {
  return requestJson(`/api/v1/knowledge/${encodeURIComponent(name)}/reindex`, {
    method: "POST"
  });
}
