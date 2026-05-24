import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "XAITutor",
  description: "XAITutor 智能体学习工作台"
};

/**
 * 渲染根布局。
 *
 * 输入：
 *   children: 当前路由页面内容。
 * 输出：返回中文语言环境下的应用根节点。
 */
export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
