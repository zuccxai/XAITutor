"""拍照解题的图片识别和知识库原题匹配流程。"""

from __future__ import annotations

from typing import Any

from deeptutor.agents.photo_solve.kb_matcher import (
    PhotoSolveKnowledgeAgent,
    retrieve_original_candidates,
)
from deeptutor.agents.photo_solve.models import PhotoSolvePipelineResult
from deeptutor.agents.photo_solve.problem_extractor import PhotoProblemExtractorAgent


class PhotoSolvePipeline:
    """执行图片识别、知识库召回和原题答案整理。"""

    def __init__(
        self,
        *,
        language: str = "zh",
        api_key: str | None = None,
        base_url: str | None = None,
        api_version: str | None = None,
    ) -> None:
        """初始化拍照解题流程。

        输入：
            language: prompt 语言。
            api_key: LLM API key。
            base_url: LLM 服务地址。
            api_version: LLM API 版本。
        输出：
            无；创建可执行的 pipeline。
        """
        self.language = language
        agent_kwargs = {
            "api_key": api_key,
            "base_url": base_url,
            "api_version": api_version,
        }
        self.extractor = PhotoProblemExtractorAgent(language=language, **agent_kwargs)
        self.knowledge_agent = PhotoSolveKnowledgeAgent(language=language, **agent_kwargs)

    def set_trace_callback(self, callback: Any) -> None:
        """注册 LLM trace 回调。

        输入：
            callback: 接收 trace payload 的回调。
        输出：
            无；后续 agent 调用会复用该回调。
        """
        self.extractor.set_trace_callback(callback)
        self.knowledge_agent.set_trace_callback(callback)

    async def run(
        self,
        *,
        user_message: str,
        attachments: list[Any],
        kb_name: str | None,
        prefer_original_solution: bool,
        min_match_score: float,
        search_top_k: int,
        event_sink: Any = None,
    ) -> PhotoSolvePipelineResult:
        """运行拍照解题前半段流程。

        输入：
            user_message: 用户补充文字。
            attachments: 图片附件。
            kb_name: 需要检索的知识库名称。
            prefer_original_solution: 是否优先使用知识库原题答案。
            min_match_score: 原题命中阈值。
            search_top_k: RAG 召回数量。
            event_sink: RAG 事件回调。
        输出：
            返回包含题目识别、知识库匹配和可选原题答案的流程结果。
        """
        extracted = await self.extractor.extract(
            user_message=user_message,
            attachments=attachments,
        )
        metadata: dict[str, Any] = {"recognition_confidence": extracted.confidence}
        query = extracted.query_text()

        if not prefer_original_solution or not kb_name or not query:
            return PhotoSolvePipelineResult(
                extracted_problem=extracted,
                mode="fallback_deep_solve",
                metadata=metadata,
            )

        rag_result = await retrieve_original_candidates(
            query=query,
            kb_name=kb_name,
            top_k=search_top_k,
            event_sink=event_sink,
        )
        match = await self.knowledge_agent.judge_match(
            problem=extracted,
            kb_name=kb_name,
            rag_result=rag_result,
            min_match_score=min_match_score,
        )
        metadata["rag_provider"] = rag_result.get("provider", "")
        metadata["rag_query"] = rag_result.get("query", query)

        if not match.matched:
            return PhotoSolvePipelineResult(
                extracted_problem=extracted,
                knowledge_match=match,
                mode="fallback_deep_solve",
                metadata=metadata,
            )

        answer = await self.knowledge_agent.write_answer_from_kb(
            problem=extracted,
            match=match,
            user_message=user_message,
        )
        return PhotoSolvePipelineResult(
            extracted_problem=extracted,
            knowledge_match=match,
            response=answer,
            mode="kb_original",
            metadata=metadata,
        )
