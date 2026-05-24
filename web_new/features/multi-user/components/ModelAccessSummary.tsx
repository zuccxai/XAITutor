import { Brain, Database, Search } from "lucide-react";
import { AssignedBadge } from "@/features/multi-user/components/AssignedBadge";
import type { ModelAccess, ModelAccessItem } from "@/features/multi-user/types";

const rows = [
  ["llm", "LLM", Brain],
  ["embedding", "Embedding", Database],
  ["search", "Search", Search]
] as const;

/**
 * 获取模型授权项展示名。
 *
 * 输入：
 *   item: 后端返回的模型授权项。
 * 输出：返回适合界面展示的名称。
 */
function itemLabel(item: ModelAccessItem): string {
  return item.model || item.provider || item.name || "已授权模型";
}

/**
 * 渲染当前用户可用模型摘要。
 *
 * 输入：
 *   access: 当前用户模型授权。
 * 输出：返回模型授权摘要面板。
 */
export function ModelAccessSummary({ access }: { access: ModelAccess }) {
  return (
    <section className="rounded-md border border-borderline bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">模型授权</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            管理员在后端保留密钥，当前账号只能使用已分配的模型资源。
          </p>
        </div>
        <AssignedBadge />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map(([key, label, Icon]) => {
          const items = access[key] || [];
          return (
            <div key={key} className="rounded-md border border-borderline bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <Icon size={14} />
                {label}
              </div>
              {items.length ? (
                <div className="mt-3 space-y-2">
                  {items.map((item, index) => (
                    <div key={`${item.profile_id}-${item.model_id}-${index}`} className="text-xs">
                      <div className="truncate font-medium text-ink">{itemLabel(item)}</div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        {item.available === false ? "不可用" : "可用"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted">暂未授权</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
