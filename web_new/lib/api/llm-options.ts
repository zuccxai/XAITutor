import { requestJson } from "@/lib/api/client";
import type { LLMSelection } from "@/lib/types/chat";

export interface LLMOption extends LLMSelection {
  profile_name: string;
  model_name: string;
  model: string;
  provider: string;
  context_window?: number;
  is_active_default: boolean;
}

export interface LLMOptionsResponse {
  active: LLMSelection | null;
  options: LLMOption[];
}

/**
 * 构建模型选择唯一键。
 *
 * 输入：
 *   selection: 模型选择对象。
 * 输出：返回 profile 和 model 拼接后的稳定键。
 */
export function llmSelectionKey(selection: LLMSelection | null | undefined): string {
  if (!selection?.profile_id || !selection.model_id) return "";
  return `${selection.profile_id}:${selection.model_id}`;
}

/**
 * 判断两个模型选择是否相同。
 *
 * 输入：
 *   a: 第一个模型选择。
 *   b: 第二个模型选择。
 * 输出：返回两个选择是否指向同一个模型。
 */
export function sameLLMSelection(
  a: LLMSelection | null | undefined,
  b: LLMSelection | null | undefined
): boolean {
  return llmSelectionKey(a) === llmSelectionKey(b);
}

/**
 * 获取后端允许当前用户选择的 LLM 选项。
 *
 * 输入：无。
 * 输出：返回当前默认模型和可选模型列表。
 */
export async function listLLMOptions(): Promise<LLMOptionsResponse> {
  const data = await requestJson<Partial<LLMOptionsResponse>>("/api/v1/settings/llm-options");
  return {
    active: data.active ?? null,
    options: Array.isArray(data.options) ? data.options : []
  };
}
