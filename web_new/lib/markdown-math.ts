const LIKELY_LATEX_BLOCK_RE = /\\[A-Za-z]+|\\\\|[_^&]/;

/**
 * 判断一组独立美元符号包裹的行是否更像块级公式。
 *
 * 输入：
 *   lines: 位于两个独立 `$` 标记之间的文本行。
 * 输出：返回这些文本是否包含明显的 LaTeX 块级公式特征。
 */
function looksLikeLatexBlock(lines: string[]): boolean {
  const block = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return block.length > 0 && LIKELY_LATEX_BLOCK_RE.test(block);
}

/**
 * 临时遮蔽 Markdown 代码片段。
 *
 * 输入：
 *   content: 原始 Markdown 文本。
 * 输出：返回遮蔽后的文本和恢复函数。
 */
function maskCodeSegments(content: string): {
  masked: string;
  restore: (value: string) => string;
} {
  const segments: string[] = [];
  const token = (index: number) => `@@XAI_CODE_${index}@@`;
  const masked = content
    .replace(/```[\s\S]*?```/g, (match) => {
      const index = segments.push(match) - 1;
      return token(index);
    })
    .replace(/`[^`\n]*`/g, (match) => {
      const index = segments.push(match) - 1;
      return token(index);
    });

  return {
    masked,
    restore: (value: string) =>
      value.replace(/@@XAI_CODE_(\d+)@@/g, (_match, index: string) => segments[Number(index)] || "")
  };
}

/**
 * 将普通引用标记转换为可点击引用链接。
 *
 * 输入：
 *   content: 已完成公式归一化的 Markdown 文本。
 * 输出：返回引用已链接化的 Markdown 文本；代码块和行内代码不会被改写。
 */
export function linkifyCitations(content: string): string {
  const { masked, restore } = maskCodeSegments(content);
  const linked = masked.replace(
    /(^|[\s(（])\[((?:web|rag|paper)-\d+|\d+(?:\s*,\s*\d+)*)\](?!\()/g,
    (_match, prefix: string, refs: string) => `${prefix}[${refs.trim()}](#references "citation")`
  );
  return restore(linked);
}

/**
 * 兼容 editor.md 和 LLM 常见输出中的数学公式分隔符。
 *
 * 输入：
 *   content: 原始 Markdown 文本。
 * 输出：返回可交给 remark-math、rehype-katex 和引用链接化流程渲染的 Markdown 文本。
 */
export function processMarkdownMath(content: string): string {
  if (!content) return "";

  let result = String(content);
  result = result.replace(/^(#{1,6})([^#\s])/gm, "$1 $2");

  const lines = result.split("\n");
  const normalizedLines: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "$" && i + 1 < lines.length) {
      let endIndex = -1;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j].trim() === "$") {
          endIndex = j;
          break;
        }
      }

      if (endIndex > i + 1 && looksLikeLatexBlock(lines.slice(i + 1, endIndex))) {
        normalizedLines.push("$$");
        for (let j = i + 1; j < endIndex; j += 1) normalizedLines.push(lines[j]);
        normalizedLines.push("$$");
        i = endIndex;
        continue;
      }
    }

    if (/^\$\$[\s\S]+\$\$$/.test(trimmed) && (trimmed.match(/\$\$/g)?.length ?? 0) === 2) {
      const inner = trimmed.slice(2, -2).trim();
      normalizedLines.push(`$$\n${inner}\n$$`);
      continue;
    }

    normalizedLines.push(
      line.replace(/\$\$([^$\n]+?)\$\$/g, (_match, expr: string) => `$${expr.trim()}$`)
    );
  }

  result = normalizedLines.join("\n");
  result = result.replace(/\$\$\s*\\\(([\s\S]*?)\\\)\s*\$\$/g, (_match, expr) => `\n$$\n${expr}\n$$\n`);
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr) => `\n$$\n${expr}\n$$\n`);
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr) => ` $${expr}$ `);

  return result.replace(/\n{3,}/g, "\n\n");
}

/**
 * 准备聊天消息 Markdown 内容。
 *
 * 输入：
 *   content: 原始消息文本。
 * 输出：返回完成数学公式归一化和安全引用链接化的 Markdown 文本。
 */
export function prepareMarkdownContent(content: string): string {
  return linkifyCitations(processMarkdownMath(content));
}
