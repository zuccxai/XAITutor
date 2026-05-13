"""知识库原题检索、判定和命中答案整理。"""

from __future__ import annotations

from typing import Any

from deeptutor.agents.base_agent import BaseAgent
from deeptutor.agents.photo_solve.models import ExtractedProblem, KnowledgeMatch
from deeptutor.core.trace import build_trace_metadata, new_call_id
from deeptutor.services.rag.service import RAGService
from deeptutor.utils.json_parser import parse_json_response


class PhotoSolveKnowledgeAgent(BaseAgent):
    """判断知识库候选是否为原题，并基于原题答案生成讲解。"""

    def __init__(self, language: str = "zh", **kwargs: Any) -> None:
        """初始化知识库匹配 agent。

        输入：
            language: prompt 语言。
            **kwargs: 透传给 BaseAgent 的 LLM 配置。
        输出：
            无；创建可用于原题判定和答案整理的 agent。
        """
        super().__init__(
            module_name="photo_solve",
            agent_name="match_judge",
            language=language,
            **kwargs,
        )
        self._answer_prompts = {}

    async def process(self, *args: Any, **kwargs: Any) -> str:
        """执行默认原题答案整理入口。

        输入：
            *args: 兼容 BaseAgent 协议的位置参数。
            **kwargs: 传给 write_answer_from_kb 的关键字参数。
        输出：
            返回 Markdown 解答文本。
        """
        return await self.write_answer_from_kb(*args, **kwargs)

    async def judge_match(
        self,
        *,
        problem: ExtractedProblem,
        kb_name: str,
        rag_result: dict[str, Any],
        min_match_score: float,
    ) -> KnowledgeMatch:
        """判断 RAG 候选是否为同一道原题。

        输入：
            problem: 图片识别出的题目。
            kb_name: 当前检索的知识库名称。
            rag_result: RAGService.search 返回结果。
            min_match_score: 命中原题所需最低分。
        输出：
            返回原题匹配判定结果。
        """
        content = str(rag_result.get("content") or rag_result.get("answer") or "").strip()
        sources = list(rag_result.get("sources") or [])
        best_score = _best_source_score(sources)
        if not content:
            return KnowledgeMatch(
                matched=False,
                score=best_score,
                reason="知识库没有返回可用于判定的内容。",
                kb_name=kb_name,
            )
        if best_score < min_match_score:
            return KnowledgeMatch(
                matched=False,
                score=best_score,
                reason="检索相似度低于原题匹配阈值。",
                content=content,
                sources=sources,
                kb_name=kb_name,
            )

        prompts = self.prompts or {}
        system_prompt = str(prompts.get("system", "")).strip()
        user_template = str(prompts.get("user_template", "")).strip()
        user_prompt = user_template.format(
            problem_text=problem.query_text(),
            kb_content=_truncate(content, 6000),
            min_match_score=min_match_score,
            best_score=best_score,
        )
        trace_meta = build_trace_metadata(
            call_id=new_call_id("photo-match"),
            phase="matching",
            label="判定知识库原题",
            call_kind="llm_match_judge",
            trace_role="observe",
            trace_group="stage",
        )
        response = await self.call_llm(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=800,
            stage="matching",
            trace_meta=trace_meta,
        )
        data = parse_json_response(response, logger_instance=self.logger, fallback={})
        if not isinstance(data, dict):
            data = {}
        matched = bool(data.get("matched"))
        reason = str(data.get("reason") or "").strip()
        return KnowledgeMatch(
            matched=matched,
            score=best_score,
            reason=reason or ("确认命中原题。" if matched else "模型判定不是同一道原题。"),
            content=content,
            sources=sources,
            kb_name=kb_name,
        )

    async def write_answer_from_kb(
        self,
        *,
        problem: ExtractedProblem,
        match: KnowledgeMatch,
        user_message: str,
    ) -> str:
        """基于命中的知识库原题内容整理答案。

        输入：
            problem: 图片识别出的题目。
            match: 已确认命中的知识库结果。
            user_message: 用户补充说明。
        输出：
            返回面向学生的 Markdown 解答。
        """
        prompts = self._load_answer_prompts()
        system_prompt = str(prompts.get("system", "")).strip()
        user_template = str(prompts.get("user_template", "")).strip()
        user_prompt = user_template.format(
            problem_text=problem.query_text(),
            user_message=user_message or "无补充说明",
            kb_content=_truncate(match.content, 8000),
            sources=_format_sources(match.sources),
        )
        trace_meta = build_trace_metadata(
            call_id=new_call_id("photo-kb-answer"),
            phase="writing",
            label="整理原题答案",
            call_kind="llm_final_response",
            trace_role="response",
            trace_group="stage",
        )
        return await self.call_llm(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=2200,
            stage="writing",
            trace_meta=trace_meta,
        )

    def _load_answer_prompts(self) -> dict[str, Any]:
        """加载原题答案整理 prompt。

        输入：
            无。
        输出：
            返回 answer_from_kb.yaml 中的 prompt 配置。
        """
        if self._answer_prompts:
            return self._answer_prompts
        from deeptutor.services.prompt.manager import get_prompt_manager

        self._answer_prompts = get_prompt_manager().load_prompts(
            module_name="photo_solve",
            agent_name="answer_from_kb",
            language=self.language,
        )
        return self._answer_prompts


async def retrieve_original_candidates(
    *,
    query: str,
    kb_name: str,
    top_k: int,
    event_sink: Any = None,
) -> dict[str, Any]:
    """从知识库召回原题候选。

    输入：
        query: 图片识别出的题干 query。
        kb_name: 知识库名称。
        top_k: 召回候选数量。
        event_sink: RAG 事件回调。
    输出：
        返回 RAGService.search 的检索结果。
    """
    rag = RAGService()
    return await rag.search(query=query, kb_name=kb_name, top_k=top_k, event_sink=event_sink)


def _best_source_score(sources: list[dict[str, Any]]) -> float:
    """提取候选来源中的最高相似度。

    输入：
        sources: RAG 返回的来源列表。
    输出：
        返回最高分；没有可用分数时返回 0。
    """
    scores: list[float] = []
    for source in sources:
        try:
            scores.append(float(source.get("score")))
        except (TypeError, ValueError):
            continue
    return max(scores) if scores else 0.0


def _truncate(text: str, limit: int) -> str:
    """截断长文本以控制 LLM 输入长度。

    输入：
        text: 原始文本。
        limit: 最大字符数。
    输出：
        返回截断后的文本。
    """
    if len(text) <= limit:
        return text
    return text[:limit] + "\n\n[内容过长，已截断]"


def _format_sources(sources: list[dict[str, Any]]) -> str:
    """格式化知识库来源列表。

    输入：
        sources: RAG 返回的来源列表。
    输出：
        返回可放进 prompt 的来源摘要。
    """
    lines = []
    for index, source in enumerate(sources[:5], start=1):
        title = str(source.get("title") or f"来源 {index}")
        score = source.get("score", "")
        path = str(source.get("source") or "")
        lines.append(f"{index}. {title} score={score} source={path}")
    return "\n".join(lines) if lines else "无来源信息"
