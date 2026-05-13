"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import type { SidebarHistoryProps } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

/**
 * 渲染应用主框架。
 *
 * 输入：
 *   title: 顶栏标题。
 *   subtitle: 顶栏副标题。
 *   status: 连接状态。
 *   children: 中间主内容。
 *   inspector: 右侧面板。
 *   history: 左侧学习记录控制参数。
 * 输出：
 *   返回包含侧栏、顶栏、主内容和右侧面板的页面框架。
 */
export function AppShell({
  title,
  subtitle,
  status,
  children,
  inspector,
  history
}: {
  title: string;
  subtitle?: string;
  status?: string;
  children: React.ReactNode;
  inspector?: React.ReactNode;
  history?: SidebarHistoryProps;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar history={history} />
      <section className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} subtitle={subtitle} status={status} />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
          {inspector}
        </div>
      </section>
    </div>
  );
}
