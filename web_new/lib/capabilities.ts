import type { CapabilityName, ToolName } from "@/lib/types/chat";

export type BackendCapabilityName =
  | "deep_solve"
  | "deep_question"
  | "deep_guided"
  | "photo_solve"
  | "competition_consulting"
  | null;

export type CapabilityConfig = {
  id: CapabilityName;
  label: string;
  backendCapability: BackendCapabilityName;
  defaultTools: ToolName[];
  allowedTools: ToolName[];
};

const ALL_TOOLS: ToolName[] = [
  "brainstorm",
  "rag",
  "web_search",
  "code_execution",
  "reason",
  "paper_search"
];

export const CAPABILITY_CONFIGS: CapabilityConfig[] = [
  {
    id: "chat",
    label: "聊天",
    backendCapability: null,
    defaultTools: ["rag"],
    allowedTools: ALL_TOOLS
  },
  {
    id: "deep_solve",
    label: "深度解题",
    backendCapability: "deep_solve",
    defaultTools: ["rag", "reason"],
    allowedTools: ["rag", "reason"]
  },
  {
    id: "deep_question",
    label: "题目生成",
    backendCapability: "deep_question",
    defaultTools: ["rag", "web_search", "code_execution"],
    allowedTools: ["rag", "web_search", "code_execution"]
  },
  {
    id: "deep_guided",
    label: "深度引导",
    backendCapability: "deep_guided",
    defaultTools: ["rag", "reason"],
    allowedTools: ["rag", "reason"]
  },
  {
    id: "photo_solve",
    label: "拍照解题",
    backendCapability: "photo_solve",
    defaultTools: ["rag", "reason"],
    allowedTools: ["rag", "reason", "code_execution"]
  },
  {
    id: "competition_consulting",
    label: "备赛助手",
    backendCapability: "competition_consulting",
    defaultTools: ["rag", "web_search"],
    allowedTools: ["rag", "web_search"]
  }
];

export const VISIBLE_CAPABILITY_CONFIGS: CapabilityConfig[] = CAPABILITY_CONFIGS.filter(
  (item) => item.id === "deep_solve" || item.id === "deep_guided"
);

/**
 * 将后端 capability 映射为 web_new 内部能力标识。
 *
 * 输入：
 *   capability: 后端会话或消息中保存的 capability。
 * 输出：返回 web_new 使用的能力标识；空值和 chat 都映射为聊天。
 */
export function fromBackendCapability(capability: string | null | undefined): CapabilityName {
  if (!capability || capability === "chat") return "chat";
  const match = CAPABILITY_CONFIGS.find((item) => item.backendCapability === capability);
  return match?.id || "chat";
}

/**
 * 查找指定能力的配置。
 *
 * 输入：
 *   capability: web_new 内部使用的能力标识。
 * 输出：返回能力配置；未知能力回退到聊天配置。
 */
export function getCapabilityConfig(capability: CapabilityName): CapabilityConfig {
  return CAPABILITY_CONFIGS.find((item) => item.id === capability) ?? CAPABILITY_CONFIGS[0];
}

/**
 * 获取发送给后端的 capability 值。
 *
 * 输入：
 *   capability: web_new 内部使用的能力标识。
 * 输出：返回后端 capability；聊天能力返回 null。
 */
export function toBackendCapability(capability: CapabilityName): BackendCapabilityName {
  return getCapabilityConfig(capability).backendCapability;
}

/**
 * 获取能力默认启用工具。
 *
 * 输入：
 *   capability: web_new 内部使用的能力标识。
 * 输出：返回该能力默认启用的工具名称数组。
 */
export function defaultToolsForCapability(capability: CapabilityName): ToolName[] {
  return [...getCapabilityConfig(capability).defaultTools];
}

/**
 * 获取能力允许使用的工具。
 *
 * 输入：
 *   capability: web_new 内部使用的能力标识。
 * 输出：返回该能力允许展示和切换的工具名称数组。
 */
export function allowedToolsForCapability(capability: CapabilityName): ToolName[] {
  return [...getCapabilityConfig(capability).allowedTools];
}
