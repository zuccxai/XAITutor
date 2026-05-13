import type { StreamEvent } from "@/lib/types/stream";
import type { ChatAttachment } from "@/lib/types/chat";

export type SessionStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected";

export interface SessionMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  capability?: string;
  attachments?: ChatAttachment[];
  events?: StreamEvent[];
  created_at: number;
}

export interface SessionPreferences {
  capability?: string | null;
  tools?: string[];
  knowledge_bases?: string[];
  language?: string;
}

export interface SessionSummary {
  id: string;
  session_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  last_message: string;
  status?: SessionStatus;
  active_turn_id?: string;
  preferences?: SessionPreferences;
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[];
}
