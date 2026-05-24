export type MemoryFile = "summary" | "profile";

export interface MemoryData {
  summary: string;
  profile: string;
  summary_updated_at: string | null;
  profile_updated_at: string | null;
  user?: {
    id?: string;
    username?: string;
    role?: string;
    is_admin?: boolean;
  };
}

export interface MemoryApiData extends MemoryData {
  saved?: boolean;
  changed?: boolean;
  cleared?: boolean;
}

export interface MemoryUpdatePayload {
  file: MemoryFile;
  content: string;
}

export interface MemoryRefreshPayload {
  session_id?: string;
  language?: string;
}

export interface MemoryClearPayload {
  file?: MemoryFile;
}
