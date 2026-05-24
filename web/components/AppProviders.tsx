"use client";

import { AppShellProvider } from "@/context/AppShellContext";
import { I18nClientBridge } from "@/i18n/I18nClientBridge";

/**
 * 提供业务页面共享的客户端上下文。
 *
 * 输入：
 *   children: 需要访问应用状态和 i18n 的页面内容。
 * 输出：返回包裹 AppShell 与 i18n 上下文后的 React 节点。
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppShellProvider>
      <I18nClientBridge>{children}</I18nClientBridge>
    </AppShellProvider>
  );
}
