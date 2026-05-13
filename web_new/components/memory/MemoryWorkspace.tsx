"use client";

import { AppShell } from "@/components/layout/AppShell";
import { MemoryPanel } from "@/components/memory/MemoryPanel";

/**
 * 渲染记忆工作区。
 *
 * 输入：
 *   无。
 * 输出：
 *   返回与知识库平级的独立记忆页面。
 */
export function MemoryWorkspace() {
  return (
    <AppShell title="记忆" subtitle="管理学习摘要和学习画像">
      <div className="h-full overflow-auto bg-page p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">记忆</h2>
          <p className="text-sm text-muted">
            维护长期学习摘要和学习画像，让后续学习持续参考。
          </p>
        </div>
        <MemoryPanel />
      </div>
    </AppShell>
  );
}
