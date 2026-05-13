const LIKELY_LATEX_BLOCK_RE = /\\[A-Za-z]+|\\\\|[_^&]/;

/**
 * 判断一组独立美元符号包裹的行是否更像块级公式。
 *
 * 输入：
 *   lines: 位于两个独立 `$` 标记之间的文本行。
 * 输出：
 *   返回这些文本是否包含明显的 LaTeX 块级公式特征。
 */
function looksLikeLatexBlock(lines: string[]): boolean {
  const block = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return block.length > 0 && LIKELY_LATEX_BLOCK_RE.test(block);
}

/**
 * 兼容 editor.md 和 LLM 常见输出中的数学公式分隔符。
 *
 * 输入：
 *   content: 原始 Markdown 文本。
 * 输出：
 *   返回可交给 remark-math 和 rehype-katex 渲染的 Markdown 文本。
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

      if (
        endIndex > i + 1 &&
        looksLikeLatexBlock(lines.slice(i + 1, endIndex))
      ) {
        normalizedLines.push("$$");
        for (let j = i + 1; j < endIndex; j += 1) {
          normalizedLines.push(lines[j]);
        }
        normalizedLines.push("$$");
        i = endIndex;
        continue;
      }
    }

    if (
      /^\$\$[\s\S]+\$\$$/.test(trimmed) &&
      (trimmed.match(/\$\$/g)?.length ?? 0) === 2
    ) {
      const inner = trimmed.slice(2, -2).trim();
      normalizedLines.push(`$$\n${inner}\n$$`);
      continue;
    }

    normalizedLines.push(
      line.replace(/\$\$([^$\n]+?)\$\$/g, (_match, expr: string) => {
        return `$${expr.trim()}$`;
      })
    );
  }

  result = normalizedLines.join("\n");

  result = result.replace(
    /\$\$\s*\\\(([\s\S]*?)\\\)\s*\$\$/g,
    (_match, expr) => {
      return `\n$$\n${expr}\n$$\n`;
    }
  );

  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr) => {
    return `\n$$\n${expr}\n$$\n`;
  });

  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr) => {
    return ` $${expr}$ `;
  });

  return result.replace(/\n{3,}/g, "\n\n");
}
