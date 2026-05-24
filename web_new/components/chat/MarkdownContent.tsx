import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { prepareMarkdownContent } from "@/lib/markdown-math";

/**
 * 渲染支持 Markdown、引用链接和数学公式的消息正文。
 *
 * 输入：
 *   content: 原始消息文本。
 * 输出：返回已启用 GFM、LaTeX、KaTeX 和安全 citation 链接化的消息内容。
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:whitespace-pre-wrap">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      >
        {prepareMarkdownContent(content)}
      </ReactMarkdown>
    </div>
  );
}
