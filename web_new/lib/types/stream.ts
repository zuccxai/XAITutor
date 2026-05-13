export type StreamEventType =
  | "stage_start"
  | "stage_end"
  | "thinking"
  | "observation"
  | "content"
  | "tool_call"
  | "tool_result"
  | "progress"
  | "sources"
  | "result"
  | "error"
  | "session"
  | "done";

export interface StreamEvent {
  type: StreamEventType;
  source?: string;
  stage?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
  turn_id?: string;
  seq?: number;
  timestamp?: number;
}

export interface AgentSource {
  title: string;
  url?: string;
  excerpt?: string;
  metadata?: Record<string, unknown>;
}
