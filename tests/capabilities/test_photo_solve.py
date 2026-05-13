"""拍照解题能力的关键路由测试。"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from deeptutor.agents.photo_solve.models import (
    ExtractedProblem,
    KnowledgeMatch,
    PhotoSolvePipelineResult,
)
from deeptutor.capabilities.photo_solve import PhotoSolveCapability
from deeptutor.core.context import Attachment, UnifiedContext
from deeptutor.core.stream import StreamEvent, StreamEventType
from deeptutor.core.stream_bus import StreamBus


async def _drain(bus: StreamBus, task) -> list[StreamEvent]:
    """收集 capability 输出事件。

    输入：
        bus: 本轮事件通道。
        task: capability.run 返回的协程。
    输出：
        返回完整事件列表。
    """
    await task
    await bus.close()
    return [event async for event in bus.subscribe()]


def _fake_llm_config() -> MagicMock:
    """构造测试用 LLM 配置。

    输入：
        无。
    输出：
        返回带 api_key/base_url/api_version 字段的 mock 配置。
    """
    cfg = MagicMock()
    cfg.api_key = "sk-test"
    cfg.base_url = None
    cfg.api_version = None
    return cfg


def _image() -> Attachment:
    """构造测试图片附件。

    输入：
        无。
    输出：
        返回最小可用的 image Attachment。
    """
    return Attachment(type="image", base64="ZmFrZQ==", filename="problem.png")


@pytest.mark.asyncio
async def test_photo_solve_requires_image_attachment() -> None:
    capability = PhotoSolveCapability()
    bus = StreamBus()
    context = UnifiedContext(user_message="解这道题", active_capability="photo_solve")

    events = await _drain(bus, capability.run(context, bus))

    errors = [event for event in events if event.type == StreamEventType.ERROR]
    assert errors
    assert "上传" in errors[0].content


@pytest.mark.asyncio
async def test_photo_solve_returns_original_kb_answer_without_fallback() -> None:
    class _FakePipeline:
        def __init__(self, **_kwargs: Any) -> None:
            return None

        def set_trace_callback(self, _callback: Any) -> None:
            return None

        async def run(self, **_kwargs: Any) -> PhotoSolvePipelineResult:
            return PhotoSolvePipelineResult(
                extracted_problem=ExtractedProblem(problem_text="1+1=?"),
                knowledge_match=KnowledgeMatch(
                    matched=True,
                    score=0.95,
                    reason="命中原题。",
                    content="答案是 2。",
                    kb_name="math",
                ),
                response="原题答案：2",
                mode="kb_original",
            )

    capability = PhotoSolveCapability()
    bus = StreamBus()
    context = UnifiedContext(
        user_message="",
        active_capability="photo_solve",
        enabled_tools=["rag"],
        knowledge_bases=["math"],
        attachments=[_image()],
    )

    with (
        patch("deeptutor.capabilities.photo_solve.PhotoSolvePipeline", new=_FakePipeline),
        patch(
            "deeptutor.services.llm.config.get_llm_config",
            return_value=_fake_llm_config(),
        ),
    ):
        events = await _drain(bus, capability.run(context, bus))

    content = "".join(
        event.content or "" for event in events if event.type == StreamEventType.CONTENT
    )
    results = [event for event in events if event.type == StreamEventType.RESULT]
    assert "原题答案：2" in content
    assert results
    assert results[0].metadata["mode"] == "kb_original"


@pytest.mark.asyncio
async def test_photo_solve_falls_back_to_main_solver_when_no_original_match() -> None:
    captured_kwargs: dict[str, Any] = {}

    class _FakePipeline:
        def __init__(self, **_kwargs: Any) -> None:
            return None

        def set_trace_callback(self, _callback: Any) -> None:
            return None

        async def run(self, **_kwargs: Any) -> PhotoSolvePipelineResult:
            return PhotoSolvePipelineResult(
                extracted_problem=ExtractedProblem(problem_text="x^2=4"),
                knowledge_match=KnowledgeMatch(
                    matched=False,
                    score=0.2,
                    reason="不是原题。",
                    kb_name="math",
                ),
                mode="fallback_deep_solve",
            )

    class _FakeSolver:
        def __init__(self, **kwargs: Any) -> None:
            captured_kwargs.update(kwargs)

        async def ainit(self) -> None:
            return None

        def set_trace_callback(self, _callback: Any) -> None:
            return None

        async def solve(self, **kwargs: Any) -> dict[str, Any]:
            captured_kwargs["solve_kwargs"] = kwargs
            return {"final_answer": "x=±2", "output_dir": "", "metadata": {}}

    capability = PhotoSolveCapability()
    bus = StreamBus()
    context = UnifiedContext(
        user_message="",
        active_capability="photo_solve",
        enabled_tools=["rag", "reason"],
        knowledge_bases=["math"],
        attachments=[_image()],
    )

    with (
        patch("deeptutor.capabilities.photo_solve.PhotoSolvePipeline", new=_FakePipeline),
        patch("deeptutor.agents.solve.main_solver.MainSolver", new=_FakeSolver),
        patch(
            "deeptutor.services.llm.config.get_llm_config",
            return_value=_fake_llm_config(),
        ),
    ):
        events = await _drain(bus, capability.run(context, bus))

    assert captured_kwargs["kb_name"] == "math"
    assert "rag" in captured_kwargs["enabled_tools"]
    assert "x^2=4" in captured_kwargs["solve_kwargs"]["question"]
    results = [event for event in events if event.type == StreamEventType.RESULT]
    assert results
    assert results[0].metadata["mode"] == "fallback_deep_solve"
