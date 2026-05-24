"""Public request contracts and config validators for built-in capabilities."""

from __future__ import annotations

from typing import Any, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from deeptutor.agents.math_animator.request_config import (
    MathAnimatorRequestConfig,
    validate_math_animator_request_config,
)
from deeptutor.agents.research.request_config import (
    DeepResearchRequestConfig,
    validate_research_request_config,
)

_RUNTIME_ONLY_KEYS = {
    "_persist_user_message",
    "followup_question_context",
    # "answer_now" is a universal escape hatch: the orchestrator re-routes
    # any capability to chat when this is present. It is never declared on
    # any per-capability ``RequestConfig`` schema, so we strip it before
    # pydantic validation and re-attach it on the runtime-only side.
    "answer_now_context",
}


class ChatRequestConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CompetitionConsultingRequestConfig(BaseModel):
    """备赛助手请求配置。

    输入：
        无公开可配置字段。
    输出：
        返回经过 Pydantic 校验的配置对象。
    """

    model_config = ConfigDict(extra="forbid")


class DeepSolveRequestConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detailed_answer: bool = True


class PhotoSolveRequestConfig(BaseModel):
    """拍照解题请求配置。

    输入：
        detailed_answer: fallback 到 deep_solve 时是否生成详细答案。
        prefer_original_solution: 是否优先检索并使用知识库原题答案。
        fallback_to_deep_solve: 未命中原题时是否进入深度解题。
        min_match_score: 认定原题命中的最低检索分。
        search_top_k: 知识库召回候选数量。
    输出：
        返回经过 Pydantic 校验的配置对象。
    """

    model_config = ConfigDict(extra="forbid")

    detailed_answer: bool = True
    prefer_original_solution: bool = True
    fallback_to_deep_solve: bool = True
    min_match_score: float = Field(default=0.7, ge=0.0, le=1.0)
    search_top_k: int = Field(default=5, ge=1, le=20)


class DeepGuidedRequestConfig(BaseModel):
    """深度引导请求配置。

    输入：
        hint_level: 可选提示层级；为空时由 agent 根据上下文判断。
        reveal_answer: 是否直接揭示答案。
    输出：
        返回经过 Pydantic 校验的配置对象。
    """

    model_config = ConfigDict(extra="forbid")

    hint_level: int | None = Field(default=None, ge=1, le=4)
    reveal_answer: bool = False


class DeepQuestionRequestConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["custom", "mimic"] = "custom"
    topic: str = ""
    num_questions: int = Field(default=1, ge=1, le=50)
    difficulty: str = ""
    question_type: str = ""
    preference: str = ""
    paper_path: str = ""
    max_questions: int = Field(default=10, ge=1, le=100)


class VisualizeRequestConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    render_mode: Literal["auto", "svg", "chartjs", "mermaid", "html"] = "auto"


def _clean_public_config(raw_config: dict[str, Any] | None) -> dict[str, Any]:
    if raw_config is None:
        return {}
    if not isinstance(raw_config, dict):
        raise ValueError("Capability config must be an object.")
    cleaned = dict(raw_config)
    for key in _RUNTIME_ONLY_KEYS:
        cleaned.pop(key, None)
    return cleaned


def _validate_model(
    model_type: type[BaseModel],
    raw_config: dict[str, Any] | None,
    *,
    label: str,
) -> BaseModel:
    cleaned = _clean_public_config(raw_config)
    try:
        return model_type.model_validate(cleaned)
    except ValidationError as exc:
        details = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        raise ValueError(f"Invalid {label} config: {details}") from exc


def validate_chat_request_config(raw_config: dict[str, Any] | None) -> ChatRequestConfig:
    return _validate_model(ChatRequestConfig, raw_config, label="chat")


def validate_competition_consulting_request_config(
    raw_config: dict[str, Any] | None,
) -> CompetitionConsultingRequestConfig:
    """校验备赛助手请求配置。

    输入：
        raw_config: WebSocket、CLI 或 API 传入的原始 config。
    输出：
        返回 CompetitionConsultingRequestConfig；字段非法时抛出 ValueError。
    """
    return _validate_model(
        CompetitionConsultingRequestConfig,
        raw_config,
        label="competition consulting",
    )


def validate_deep_solve_request_config(
    raw_config: dict[str, Any] | None,
) -> DeepSolveRequestConfig:
    return _validate_model(DeepSolveRequestConfig, raw_config, label="deep solve")


def validate_photo_solve_request_config(
    raw_config: dict[str, Any] | None,
) -> PhotoSolveRequestConfig:
    """校验拍照解题请求配置。

    输入：
        raw_config: WebSocket、CLI 或 API 传入的原始 config。
    输出：
        返回 PhotoSolveRequestConfig；字段非法时抛出 ValueError。
    """
    return _validate_model(PhotoSolveRequestConfig, raw_config, label="photo solve")


def validate_deep_guided_request_config(
    raw_config: dict[str, Any] | None,
) -> DeepGuidedRequestConfig:
    """校验深度引导请求配置。

    输入：
        raw_config: WebSocket、CLI 或 API 传入的原始 config。
    输出：
        返回 DeepGuidedRequestConfig；字段非法时抛出 ValueError。
    """
    return _validate_model(DeepGuidedRequestConfig, raw_config, label="deep guided")


def validate_deep_question_request_config(
    raw_config: dict[str, Any] | None,
) -> DeepQuestionRequestConfig:
    return _validate_model(DeepQuestionRequestConfig, raw_config, label="deep question")


def validate_visualize_request_config(
    raw_config: dict[str, Any] | None,
) -> VisualizeRequestConfig:
    return _validate_model(VisualizeRequestConfig, raw_config, label="visualize")


def build_request_schema(model_type: type[BaseModel]) -> dict[str, Any]:
    return model_type.model_json_schema(mode="validation")


CAPABILITY_CONFIG_VALIDATORS: dict[str, Callable[[dict[str, Any] | None], Any]] = {
    "chat": validate_chat_request_config,
    "competition_consulting": validate_competition_consulting_request_config,
    "deep_solve": validate_deep_solve_request_config,
    "photo_solve": validate_photo_solve_request_config,
    "deep_guided": validate_deep_guided_request_config,
    "deep_question": validate_deep_question_request_config,
    "deep_research": validate_research_request_config,
    "math_animator": validate_math_animator_request_config,
    "visualize": validate_visualize_request_config,
}

CAPABILITY_REQUEST_SCHEMAS: dict[str, dict[str, Any]] = {
    "chat": build_request_schema(ChatRequestConfig),
    "competition_consulting": build_request_schema(CompetitionConsultingRequestConfig),
    "deep_solve": build_request_schema(DeepSolveRequestConfig),
    "photo_solve": build_request_schema(PhotoSolveRequestConfig),
    "deep_guided": build_request_schema(DeepGuidedRequestConfig),
    "deep_question": build_request_schema(DeepQuestionRequestConfig),
    "deep_research": build_request_schema(DeepResearchRequestConfig),
    "math_animator": build_request_schema(MathAnimatorRequestConfig),
    "visualize": build_request_schema(VisualizeRequestConfig),
}


def validate_capability_config(
    capability: str, raw_config: dict[str, Any] | None
) -> dict[str, Any]:
    validator = CAPABILITY_CONFIG_VALIDATORS.get(capability)
    if validator is None:
        return _clean_public_config(raw_config)
    model = validator(raw_config)
    if isinstance(model, BaseModel):
        return model.model_dump(exclude_none=True)
    return _clean_public_config(raw_config)


def get_capability_request_schema(capability: str) -> dict[str, Any]:
    return dict(CAPABILITY_REQUEST_SCHEMAS.get(capability, {}))


__all__ = [
    "CAPABILITY_CONFIG_VALIDATORS",
    "CAPABILITY_REQUEST_SCHEMAS",
    "ChatRequestConfig",
    "CompetitionConsultingRequestConfig",
    "DeepGuidedRequestConfig",
    "DeepQuestionRequestConfig",
    "DeepSolveRequestConfig",
    "PhotoSolveRequestConfig",
    "VisualizeRequestConfig",
    "build_request_schema",
    "get_capability_request_schema",
    "validate_capability_config",
    "validate_chat_request_config",
    "validate_competition_consulting_request_config",
    "validate_deep_guided_request_config",
    "validate_deep_question_request_config",
    "validate_deep_solve_request_config",
    "validate_photo_solve_request_config",
    "validate_visualize_request_config",
]
