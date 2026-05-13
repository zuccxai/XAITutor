const FENCE = "```";

export const CO_WRITER_SAMPLE_TEMPLATE = `# 学习助理 Co-Writer

> 学习助理's built-in writing canvas for notes, reports, tutorials, and AI-assisted drafts.

### Features

- Support Standard Markdown / CommonMark / GFM for everyday writing
- Real-time preview for headings, tables, code, math, flowchart, and sequence diagrams
- AI editing workflows for rewrite, shorten, and expand
- HTML tag decoding for tags like <sub>, <sup>, <abbr>, and <mark>
- A practical starter draft for 学习助理 product docs and learning content

## Table of Contents

[TOCM]

[TOC]

#学习助理 Mission
##学习助理 Product Surface
###学习助理 Learning Experience
####学习助理 Co-Writer
#####学习助理 Knowledge Layer
######学习助理 Agent Runtime

#学习助理 Docs [Project Overview](#deeptutor-mission "Jump to project overview")
##学习助理 Authoring [Co-Writer Section](#deeptutor-co-writer "Jump to co-writer section")
###学习助理 Research [Learning Note](#deeptutor-learning-note "Jump to learning note")

## Headers (Underline)

学习助理 Learning Note
=============

学习助理 Study Outline
-------------

### Characters

----

~~Deprecated behavior~~ <s>Legacy formatting path</s>
*Italic* _Italic_
**Emphasis** __Emphasis__
***Emphasis Italic*** ___Emphasis Italic___

Superscript: X<sub>2</sub>, Subscript: O<sup>2</sup>

**Abbreviation(link HTML abbr tag)**

The <abbr title="Large Language Model">LLM</abbr> layer powers 学习助理 while the <abbr title="Retrieval Augmented Generation">RAG</abbr> layer provides grounded knowledge support.

### Blockquotes

> 学习助理 helps students turn questions into structured understanding.
>
> "Learn deeply, write clearly.", [学习助理](#deeptutor-co-writer)

### Links

[学习助理 Overview](#deeptutor-mission)

[学习助理 Co-Writer](#deeptutor-co-writer "co-writer section")

[学习助理 Runtime](#deeptutor-agent-runtime)

[Reference link][deeptutor-doc]

[deeptutor-doc]: #deeptutor-learning-note

### Code Blocks

#### Inline code

\`deeptutor chat --once "Summarize this section"\`

#### Code Blocks (Indented style)

    from deeptutor.runtime.orchestrator import ChatOrchestrator
    orchestrator = ChatOrchestrator()
    print("学习助理 is ready.")

#### Python

${FENCE}python
from deeptutor.runtime.orchestrator import ChatOrchestrator
from deeptutor.core.context import UnifiedContext


async def run_demo() -> str:
    orchestrator = ChatOrchestrator()
    context = UnifiedContext(
        user_query="Explain Newton's second law",
        capability="chat",
    )
    result = await orchestrator.run(context)
    return result.get("response", "")
${FENCE}

#### JSON config

${FENCE}json
{
  "app_name": "学习助理",
  "default_capability": "chat",
  "enabled_tools": ["rag", "web_search", "code_execution", "reason"],
  "ui": {
    "co_writer_template": true
  }
}
${FENCE}

#### HTML code

${FENCE}html
<section class="deeptutor-card">
  <h1>学习助理</h1>
  <p>Write, revise, and organize learning content with AI.</p>
</section>
${FENCE}

### Images

![](/logo-ver2.png)

> 学习助理 brand mark used inside the co-writer template.

### Lists

- 学习助理 Chat
- 学习助理 Co-Writer
- 学习助理 Research

1. Draft a concept note
2. Ask AI to refine it
3. Export the polished markdown

### Tables

Feature       | Description
------------- | -------------
Co-Writer     | Draft and refine Markdown content
Chat          | Ask questions and iterate ideas
Research      | Build structured multi-step reports

| Capability    | Primary Use Case                     |
| ------------- | ------------------------------------ |
| \`chat\`       | General tutoring and guidance        |
| \`deep_solve\` | Structured problem solving           |
| \`deep_question\` | Question generation and validation |

### Markdown extras

- [x] Draft a 学习助理 product note
- [x] Add references and structure
- [ ] Polish the final explanation
  - [ ] Check headings
  - [ ] Check citations

### TeX (LaTeX)

$$ E=mc^2 $$

Inline $$E=mc^2$$ appears in physics notes, and Inline $$a^2+b^2=c^2$$ appears in geometry notes.

$$\(\sqrt{3x-1}+(1+x)^2\)$$

$$ \sin(\alpha)^{\theta}=\sum_{i=0}^{n}(x^i + \cos(f))$$

### FlowChart

${FENCE}flow
st=>start: Student asks a question
op=>operation: 学习助理 analyzes intent
cond=>condition: Need deep workflow?
chat=>operation: Answer with chat capability
solve=>operation: Route to deep solve
e=>end: Return structured response

st->op->cond
cond(no)->chat
cond(yes)->solve
chat->e
solve->e
${FENCE}

### Sequence Diagram

${FENCE}seq
Student->学习助理: Ask for help
学习助理->KnowledgeBase: Load context
Note right of 学习助理: Collect memory\nand relevant knowledge
学习助理-->Student: Return guided response
Student->>学习助理: Request rewrite in co-writer
${FENCE}

### End
`;
