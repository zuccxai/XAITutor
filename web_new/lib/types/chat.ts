import type { StreamEvent } from "@/lib/types/stream";

export type CapabilityName =
  | "chat"
  | "deep_solve"
  | "deep_question"
  | "deep_guided"
  | "photo_solve"
  | "competition_consulting";

export type ToolName =
  | "rag"
  | "web_search"
  | "code_execution"
  | "paper_search"
  | "reason"
  | "brainstorm";

export interface ChatAttachment {
  type: "image" | string;
  filename?: string;
  base64?: string;
  mime_type?: string;
  previewUrl?: string;
  url?: string;
  size?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  capability?: CapabilityName;
  events?: StreamEvent[];
  attachments?: ChatAttachment[];
}

export interface LLMSelection {
  profile_id: string;
  model_id: string;
}

export interface RequestSnapshot {
  capability?: string | null;
  tools?: string[];
  knowledge_bases?: string[];
  llm_selection?: LLMSelection | null;
  memory_references?: string[];
  skills?: string[];
  attachments?: ChatAttachment[];
  language?: string;
  config?: Record<string, unknown>;
}

export interface StartTurnPayload {
  type: "start_turn";
  content: string;
  capability?: CapabilityName | string | null;
  tools?: string[];
  knowledge_bases?: string[];
  llm_selection?: LLMSelection | null;
  memory_references?: string[];
  skills?: string[];
  attachments?: ChatAttachment[];
  session_id?: string | null;
  language?: string;
  config?: Record<string, unknown>;
}

export interface ResumeTurnPayload {
  type: "resume_from";
  turn_id: string;
  seq?: number;
}

export type WsPayload = StartTurnPayload | ResumeTurnPayload | { type: "ping" };
