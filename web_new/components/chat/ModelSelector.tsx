"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { listLLMOptions, llmSelectionKey, type LLMOption } from "@/lib/api/llm-options";
import type { LLMSelection } from "@/lib/types/chat";

/**
 * 获取模型选项展示文本。
 *
 * 输入：
 *   option: 后端返回的模型选项。
 * 输出：返回适合下拉框展示的模型名称。
 */
function optionLabel(option: LLMOption): string {
  const provider = option.provider ? ` · ${option.provider}` : "";
  const active = option.is_active_default ? "（默认）" : "";
  return `${option.profile_name} / ${option.model_name}${provider}${active}`;
}

/**
 * 渲染轻量模型选择器。
 *
 * 输入：
 *   value: 当前模型选择。
 *   onChangeAction: 模型选择变更回调。
 * 输出：返回与 web_new 风格一致的模型下拉控件。
 */
export function ModelSelector({
  value,
  onChangeAction
}: {
  value: LLMSelection | null;
  onChangeAction: (selection: LLMSelection | null) => void;
}) {
  const [options, setOptions] = useState<LLMOption[]>([]);
  const [active, setActive] = useState<LLMSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载当前用户可用模型。
   *
   * 输入：无。
   * 输出：无；通过组件状态保存模型选项和默认模型。
   */
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listLLMOptions();
      setOptions(data.options);
      setActive(data.active);
      if (!value && data.active) onChangeAction(data.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载模型失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // 首次加载即可，value 变化不应重新拉取选项。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedKey = llmSelectionKey(value || active);
  const selectedExists = useMemo(
    () => options.some((option) => llmSelectionKey(option) === selectedKey),
    [options, selectedKey]
  );

  return (
    <div className="flex items-center gap-2">
      <Brain size={15} className="text-muted" />
      <select
        value={selectedExists ? selectedKey : ""}
        onChange={(event) => {
          const option = options.find((item) => llmSelectionKey(item) === event.target.value);
          onChangeAction(option ? { profile_id: option.profile_id, model_id: option.model_id } : null);
        }}
        disabled={loading || !options.length}
        className="h-8 min-w-[220px] rounded-md border border-borderline bg-white px-2 text-xs text-ink outline-none focus:border-accent disabled:bg-slate-50 disabled:text-muted"
        title={error || "选择本轮使用的模型"}
      >
        <option value="">{loading ? "加载模型中..." : error ? "模型加载失败" : "系统默认模型"}</option>
        {options.map((option) => (
          <option key={llmSelectionKey(option)} value={llmSelectionKey(option)}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
      {error ? (
        <Button
          type="button"
          variant="ghost"
          className="size-8 p-0"
          onClick={() => void load()}
          title="重新加载模型"
          aria-label="重新加载模型"
        >
          <RefreshCw size={14} />
        </Button>
      ) : null}
    </div>
  );
}
