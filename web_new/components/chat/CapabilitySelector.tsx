"use client";

import { VISIBLE_CAPABILITY_CONFIGS } from "@/lib/capabilities";
import { cn } from "@/lib/cn";
import type { CapabilityName } from "@/lib/types/chat";

/**
 * 渲染能力切换控件。
 *
 * 输入：
 *   value: 当前能力。
 *   onChangeAction: 能力变更回调。
 * 输出：返回能力分段按钮。
 */
export function CapabilitySelector({
  value,
  onChangeAction
}: {
  value: CapabilityName;
  onChangeAction: (value: CapabilityName) => void;
}) {
  return (
    <div className="flex rounded-md border border-borderline bg-white p-1">
      {VISIBLE_CAPABILITY_CONFIGS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "h-8 rounded px-3 text-sm",
            value === item.id ? "bg-blue-50 text-accent" : "text-muted hover:bg-slate-50"
          )}
          onClick={() => onChangeAction(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
