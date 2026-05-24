export interface IndexVersion {
  id?: string;
  version_id?: string;
  created_at?: string | number;
  action?: string;
  document_count?: number;
  status?: string;
}

export interface KnowledgeBaseSummary {
  id?: string;
  name: string;
  is_default?: boolean;
  status?: string;
  path?: string;
  source?: "admin" | "user" | string;
  assigned?: boolean;
  read_only?: boolean;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  progress?: Record<string, unknown>;
  statistics?: {
    documents?: number;
    files?: number;
    raw_documents?: number;
    rag_provider?: string;
    last_indexed_at?: string | number | null;
    last_indexed_count?: number | null;
    last_indexed_action?: string | null;
    index_versions?: IndexVersion[];
    [key: string]: unknown;
  };
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
