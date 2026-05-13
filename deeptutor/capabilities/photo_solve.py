"""拍照解题能力。"""

from __future__ import annotations

import asyncio
from typing import Any

from deeptutor.agents.photo_solve import PhotoSolvePipeline, PhotoSolvePipelineResult
from deeptutor.capabilities.request_contracts import get_capability_request_schema
from deeptutor.core.capability_protocol import BaseCapability, CapabilityManifest
from deeptutor.core.context import UnifiedContext
from deeptutor.core.stream_bus import StreamBus
from deeptutor.core.trace import derive_trace_metadata, merge_trace_metadata


def _image_attachments(attachments: list[Any]) -> list[Any]:
    """筛选可转发给视觉模型的图片附件。

    输入：
        attachments: 用户本轮上传的附件。
    输出：
        返回 type 为 image 的附件列表。
    """
    return [att for att in attachments or [] if getattr(att, "type", "") == "image"]


class PhotoSolveCapability(BaseCapability):
    """先拍照识题和检索原题，未命中时回退到 deep_solve 的能力。"""

    manifest = CapabilityManifest(
        name="photo_solve",
        description="Photo-based problem solving with original-question KB matching.",
        stages=["recognition", "retrieval", "matching", "solving", "writing"],
        tools_used=["rag", "reason", "code_execution"],
        cli_aliases=["photo", "photo_solve"],
        request_schema=get_capability_request_schema("photo_solve"),
    )

    async def run(self, context: UnifiedContext, stream: StreamBus) -> None:
        """执行拍照解题流程。

        输入：
            context: 统一上下文，包含图片附件、知识库和配置。
            stream: 统一事件输出通道。
        输出：
            无；通过 stream 输出进度、内容和 result。
        """
        from deeptutor.services.llm.config import get_llm_config

        images = _image_attachments(context.attachments)
        if not images:
            await stream.error(
                "拍照解题需要至少上传一张题目图片。",
                source=self.name,
                stage="recognition",
            )
            return

        llm_config = get_llm_config()
        overrides = context.config_overrides
        detailed = bool(overrides.get("detailed_answer", True))
        prefer_original = bool(overrides.get("prefer_original_solution", True))
        fallback_to_deep_solve = bool(overrides.get("fallback_to_deep_solve", True))
        min_match_score = float(overrides.get("min_match_score", 0.7) or 0.7)
        search_top_k = int(overrides.get("search_top_k", 5) or 5)

        enabled_tools = list(
            self.manifest.tools_used if context.enabled_tools is None else context.enabled_tools
        )
        rag_enabled = "rag" in enabled_tools
        kb_name = context.knowledge_bases[0] if rag_enabled and context.knowledge_bases else None
        if rag_enabled and not kb_name:
            enabled_tools = [tool for tool in enabled_tools if tool != "rag"]
            rag_enabled = False
            await stream.progress(
                "已开启 RAG 但未选择知识库，本轮跳过原题检索。",
                source=self.name,
                stage="retrieval",
                metadata={"trace_kind": "warning", "reason": "rag_without_kb"},
            )

        pipeline = PhotoSolvePipeline(
            language=context.language,
            api_key=llm_config.api_key,
            base_url=llm_config.base_url,
            api_version=llm_config.api_version,
        )
        pipeline.set_trace_callback(self._build_trace_bridge(stream))

        await stream.progress(
            "正在识别题目图片...",
            source=self.name,
            stage="recognition",
            metadata={"image_count": len(images)},
        )
        result = await pipeline.run(
            user_message=context.user_message,
            attachments=images,
            kb_name=kb_name,
            prefer_original_solution=prefer_original and rag_enabled,
            min_match_score=min_match_score,
            search_top_k=search_top_k,
            event_sink=self._build_rag_event_sink(stream),
        )

        await stream.progress(
            "题目识别完成。",
            source=self.name,
            stage="recognition",
            metadata={"extracted_problem": result.extracted_problem.to_dict()},
        )

        if result.knowledge_match is not None:
            await stream.progress(
                result.knowledge_match.reason,
                source=self.name,
                stage="matching",
                metadata={"knowledge_match": result.knowledge_match.to_dict()},
            )

        if result.mode == "kb_original" and result.response:
            await stream.content(result.response, source=self.name, stage="writing")
            await stream.result(result.to_result_payload(), source=self.name)
            return

        if not fallback_to_deep_solve:
            response = self._format_no_match_response(result)
            await stream.content(response, source=self.name, stage="writing")
            result.response = response
            result.mode = "no_original_match"
            await stream.result(result.to_result_payload(), source=self.name)
            return

        await self._run_deep_solve_fallback(
            context=context,
            stream=stream,
            pipeline_result=result,
            enabled_tools=enabled_tools,
            kb_name=kb_name if rag_enabled else None,
            detailed=detailed,
            llm_config=llm_config,
        )

    async def _run_deep_solve_fallback(
        self,
        *,
        context: UnifiedContext,
        stream: StreamBus,
        pipeline_result: PhotoSolvePipelineResult,
        enabled_tools: list[str],
        kb_name: str | None,
        detailed: bool,
        llm_config: Any,
    ) -> None:
        """调用 MainSolver 继续深度解题。

        输入：
            context: 原始统一上下文。
            stream: 统一事件输出通道。
            pipeline_result: 拍照识别和知识库匹配结果。
            enabled_tools: 本轮实际启用工具。
            kb_name: 可用于 fallback 的知识库名称。
            detailed: 是否生成详细答案。
            llm_config: LLM 运行配置。
        输出：
            无；通过 stream 输出 deep_solve fallback 的内容和 result。
        """
        from deeptutor.agents.solve.main_solver import MainSolver
        from deeptutor.services.path_service import get_path_service

        solve_question = self._build_fallback_question(context, pipeline_result)
        await stream.progress(
            "知识库未确认命中原题，正在进入深度解题流程。",
            source=self.name,
            stage="solving",
            metadata={"fallback": "deep_solve"},
        )

        solver = MainSolver(
            api_key=llm_config.api_key,
            base_url=llm_config.base_url,
            api_version=llm_config.api_version,
            kb_name=kb_name,
            language=context.language,
            output_base_dir=str(get_path_service().get_photo_solve_dir()),
            enabled_tools=enabled_tools,
            disable_planner_retrieve=not bool(kb_name and "rag" in enabled_tools),
        )
        await solver.ainit()
        if hasattr(solver, "set_trace_callback"):
            solver.set_trace_callback(self._build_trace_bridge(stream))

        def _progress_bridge(stage: str, progress: dict[str, Any]):
            async def _emit() -> None:
                status = str(progress.get("status", stage))
                detail = str(progress.get("step_target", "") or "")[:80]
                message = f"{status}: {detail}" if detail else status
                await stream.progress(
                    message,
                    source=self.name,
                    stage=self._normalize_solver_stage(stage),
                )

            try:
                asyncio.get_running_loop().create_task(_emit())
            except RuntimeError:
                pass

        setattr(solver, "_send_progress_update", _progress_bridge)

        content_streamed = False

        async def _content_sink(chunk: str) -> None:
            nonlocal content_streamed
            content_streamed = True
            await stream.content(chunk, source=self.name, stage="writing")

        setattr(solver, "_content_callback", _content_sink)

        solver_result = await solver.solve(
            question=solve_question,
            attachments=_image_attachments(context.attachments),
            verbose=False,
            detailed=detailed,
            conversation_context=str(
                context.metadata.get("conversation_context_text", "") or ""
            ).strip(),
        )
        final_answer = str(solver_result.get("final_answer", "") or "")
        if final_answer and not content_streamed:
            await stream.content(final_answer, source=self.name, stage="writing")

        await stream.result(
            {
                "response": final_answer,
                "mode": "fallback_deep_solve",
                "extracted_problem": pipeline_result.extracted_problem.to_dict(),
                "knowledge_match": (
                    pipeline_result.knowledge_match.to_dict()
                    if pipeline_result.knowledge_match is not None
                    else None
                ),
                "output_dir": solver_result.get("output_dir", ""),
                "metadata": {
                    **pipeline_result.metadata,
                    **dict(solver_result.get("metadata", {}) or {}),
                    "fallback": "deep_solve",
                },
            },
            source=self.name,
        )

    def _build_trace_bridge(self, stream: StreamBus):
        """构建 LLM 和工具 trace 到 StreamBus 的桥接函数。

        输入：
            stream: 统一事件输出通道。
        输出：
            返回可注册给 agent 或 solver 的异步回调。
        """

        async def _trace_bridge(update: dict[str, Any]) -> None:
            event = str(update.get("event", "") or "")
            stage = self._normalize_solver_stage(
                str(update.get("phase") or update.get("stage") or "solving")
            )
            base_metadata = {
                key: value
                for key, value in update.items()
                if key
                not in {"event", "state", "response", "chunk", "result", "tool_args", "tool_name"}
            }

            if event == "llm_call":
                await self._emit_llm_trace(stream, update, stage, base_metadata)
                return
            if event == "llm_observation":
                response = str(update.get("response", "") or "")
                if response:
                    await stream.observation(
                        response,
                        source=self.name,
                        stage=stage,
                        metadata=derive_trace_metadata(
                            base_metadata,
                            trace_role="observe",
                            trace_kind="observation",
                        ),
                    )
                return
            if event == "tool_call":
                await stream.tool_call(
                    tool_name=str(update.get("tool_name", "") or "tool"),
                    args=update.get("tool_args", {}) or {},
                    source=self.name,
                    stage=stage,
                    metadata=derive_trace_metadata(
                        base_metadata,
                        trace_role="tool",
                        trace_kind="tool_call",
                    ),
                )
                return
            if event == "tool_result":
                await stream.tool_result(
                    tool_name=str(update.get("tool_name", "") or "tool"),
                    result=str(update.get("result", "") or ""),
                    source=self.name,
                    stage=stage,
                    metadata=derive_trace_metadata(
                        base_metadata,
                        trace_role="tool",
                        trace_kind="tool_result",
                        sources=update.get("sources", []) or [],
                    ),
                )

        return _trace_bridge

    async def _emit_llm_trace(
        self,
        stream: StreamBus,
        update: dict[str, Any],
        stage: str,
        base_metadata: dict[str, Any],
    ) -> None:
        """输出 LLM 调用状态事件。

        输入：
            stream: 统一事件输出通道。
            update: agent 或 solver 产生的 trace payload。
            stage: 标准化阶段名。
            base_metadata: 已清洗的 trace 元信息。
        输出：
            无；通过 stream 输出状态、思考片段或错误。
        """
        state = str(update.get("state", "running"))
        label = str(update.get("label", "") or "")
        if state == "running":
            await stream.progress(
                label,
                source=self.name,
                stage=stage,
                metadata=merge_trace_metadata(
                    base_metadata,
                    {"trace_kind": "call_status", "call_state": "running"},
                ),
            )
            return
        if state == "streaming":
            chunk = str(update.get("chunk", "") or "")
            if chunk:
                await stream.thinking(
                    chunk,
                    source=self.name,
                    stage=stage,
                    metadata=merge_trace_metadata(base_metadata, {"trace_kind": "llm_chunk"}),
                )
            return
        if state == "complete":
            response = str(update.get("response", "") or "")
            if response and not update.get("streaming", False):
                await stream.thinking(
                    response,
                    source=self.name,
                    stage=stage,
                    metadata=merge_trace_metadata(base_metadata, {"trace_kind": "llm_output"}),
                )
            await stream.progress(
                "",
                source=self.name,
                stage=stage,
                metadata=merge_trace_metadata(
                    base_metadata,
                    {"trace_kind": "call_status", "call_state": "complete"},
                ),
            )
            return
        if state == "error":
            await stream.error(
                str(update.get("response", "") or "LLM call failed."),
                source=self.name,
                stage=stage,
                metadata=merge_trace_metadata(
                    base_metadata,
                    {"trace_kind": "call_status", "call_state": "error"},
                ),
            )

    def _build_rag_event_sink(self, stream: StreamBus):
        """构建 RAGService 事件桥接函数。

        输入：
            stream: 统一事件输出通道。
        输出：
            返回可传给 RAGService.search 的异步回调。
        """

        async def _sink(event_type: str, message: str, metadata: dict[str, Any]) -> None:
            if event_type == "status":
                await stream.progress(
                    message,
                    source=self.name,
                    stage="retrieval",
                    metadata=merge_trace_metadata(
                        metadata,
                        {
                            "trace_kind": "tool_log",
                            "trace_role": "retrieve",
                            "tool_name": "rag",
                        },
                    ),
                )

        return _sink

    @staticmethod
    def _normalize_solver_stage(stage: str) -> str:
        """标准化底层 solver 阶段名称。

        输入：
            stage: 原始阶段名。
        输出：
            返回拍照解题能力使用的阶段名。
        """
        mapping = {
            "plan": "solving",
            "planning": "solving",
            "solve": "solving",
            "solving": "solving",
            "reasoning": "solving",
            "write": "writing",
            "writing": "writing",
            "recognition": "recognition",
            "retrieval": "retrieval",
            "matching": "matching",
        }
        return mapping.get(stage, stage or "solving")

    @staticmethod
    def _build_fallback_question(
        context: UnifiedContext,
        pipeline_result: PhotoSolvePipelineResult,
    ) -> str:
        """构造交给 MainSolver 的题目文本。

        输入：
            context: 原始统一上下文。
            pipeline_result: 图片识别结果。
        输出：
            返回包含识别题干和用户补充说明的题目文本。
        """
        parts = ["请根据拍照识别结果解答这道题。"]
        problem_text = pipeline_result.extracted_problem.query_text()
        if problem_text:
            parts.append(f"识别题目：\n{problem_text}")
        if pipeline_result.extracted_problem.notes:
            notes = "\n".join(f"- {item}" for item in pipeline_result.extracted_problem.notes)
            parts.append(f"图片补充信息：\n{notes}")
        if context.user_message.strip():
            parts.append(f"用户补充说明：\n{context.user_message.strip()}")
        return "\n\n".join(parts)

    @staticmethod
    def _format_no_match_response(result: PhotoSolvePipelineResult) -> str:
        """构造不启用 fallback 时的未命中响应。

        输入：
            result: 拍照识别和知识库匹配结果。
        输出：
            返回 Markdown 响应文本。
        """
        match_reason = (
            result.knowledge_match.reason
            if result.knowledge_match is not None
            else "未执行知识库原题匹配。"
        )
        problem = result.extracted_problem.query_text() or "未能稳定识别题目文本。"
        return (
            "### 题目识别结果\n\n"
            f"{problem}\n\n"
            "### 原题匹配结果\n\n"
            f"{match_reason}\n\n"
            "当前配置未开启未命中后的深度解题 fallback。"
        )
