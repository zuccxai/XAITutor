"""从题目图片中提取可检索、可解题的结构化题干。"""

from __future__ import annotations

from typing import Any

from deeptutor.agents.base_agent import BaseAgent
from deeptutor.agents.photo_solve.models import ExtractedProblem
from deeptutor.core.trace import build_trace_metadata, new_call_id
from deeptutor.utils.json_parser import parse_json_response


class PhotoProblemExtractorAgent(BaseAgent):
    """使用多模态 LLM 从图片附件中识别题目。"""

    def __init__(self, language: str = "zh", **kwargs: Any) -> None:
        """初始化题目识别 agent。

        输入：
            language: prompt 语言。
            **kwargs: 透传给 BaseAgent 的 LLM 配置。
        输出：
            无；创建可调用的题目识别 agent。
        """
        super().__init__(
            module_name="photo_solve",
            agent_name="problem_extractor",
            language=language,
            **kwargs,
        )

    async def process(self, *args: Any, **kwargs: Any) -> ExtractedProblem:
        """执行默认题目识别入口。

        输入：
            *args: 兼容 BaseAgent 协议的位置参数。
            **kwargs: 传给 extract 的关键字参数。
        输出：
            返回结构化题干。
        """
        return await self.extract(*args, **kwargs)

    async def extract(
        self,
        *,
        user_message: str,
        attachments: list[Any],
    ) -> ExtractedProblem:
        """识别图片中的题目文本。

        输入：
            user_message: 用户对图片的补充说明。
            attachments: 本轮上传的图片附件。
        输出：
            返回结构化题干；模型输出异常时尽量保留用户文本作为 fallback。
        """
        prompts = self.prompts or {}
        system_prompt = str(prompts.get("system", "")).strip()
        user_template = str(prompts.get("user_template", "")).strip()
        user_prompt = user_template.format(user_message=user_message or "无补充说明")
        trace_meta = build_trace_metadata(
            call_id=new_call_id("photo-recognition"),
            phase="recognition",
            label="识别题目图片",
            call_kind="llm_multimodal_extraction",
            trace_role="observe",
            trace_group="stage",
        )
        response = await self.call_llm(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1600,
            stage="recognition",
            attachments=attachments,
            trace_meta=trace_meta,
        )
        data = parse_json_response(response, logger_instance=self.logger, fallback={})
        if not isinstance(data, dict):
            data = {}

        problem_text = str(data.get("problem_text") or user_message or "").strip()
        raw_text = str(data.get("raw_text") or problem_text).strip()
        subject = str(data.get("subject") or "").strip()
        confidence = _coerce_float(data.get("confidence"), default=0.0)
        notes = data.get("notes") if isinstance(data.get("notes"), list) else []
        normalized_notes = [str(item).strip() for item in notes if str(item).strip()]
        return ExtractedProblem(
            problem_text=problem_text,
            raw_text=raw_text,
            subject=subject,
            confidence=max(0.0, min(confidence, 1.0)),
            notes=normalized_notes,
        )


def _coerce_float(value: Any, *, default: float) -> float:
    """将模型返回值转换为 float。

    输入：
        value: 待转换值。
        default: 转换失败时使用的默认值。
    输出：
        返回 float 数值。
    """
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
