export interface KnowledgeBaseSummary {
  name: string;
  is_default?: boolean;
  status?: string;
  path?: string;
  metadata?: Record<string, unknown>;
  progress?: Record<string, unknown>;
  statistics?: Record<string, unknown>;
}

export interface RagProviderSummary {
  id: string;
  name: string;
  description?: string;
}

export interface KnowledgeUploadPolicy {
  extensions: string[];
  accept: string;
  max_file_size_bytes: number;
  max_pdf_size_bytes: number;
}

export interface KnowledgeBaseFile {
  name: string;
  size: number;
  modified: number;
  mime_type?: string | null;
}

export interface KnowledgeTaskResponse {
  task_id?: string;
  message?: string;
  files?: string[];
  noop?: boolean;
}

export interface SystemStatus {
  status?: string;
  llm?: Record<string, unknown>;
  embeddings?: Record<string, unknown>;
  search?: Record<string, unknown>;
}
