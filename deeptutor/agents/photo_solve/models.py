"""拍照解题流程中的结构化数据模型。"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class ExtractedProblem:
    """保存从图片和用户补充文本中识别出的题目信息。

    输入：
        problem_text: 可用于检索和解题的题干文本。
        raw_text: 视觉模型提取的原始文本。
        subject: 学科或题型标签。
        confidence: 识别可信度，范围由模型自行估计。
        notes: 额外说明，例如图形、表格或选项描述。
    输出：
        返回可序列化为 dict 的题目识别结果。
    """

    problem_text: str
    raw_text: str = ""
    subject: str = ""
    confidence: float = 0.0
    notes: list[str] = field(default_factory=list)

    def query_text(self) -> str:
        """构造知识库检索用文本。

        输入：
            无。
        输出：
            返回优先使用题干、其次使用原始识别文本的检索 query。
        """
        return (self.problem_text or self.raw_text).strip()

    def to_dict(self) -> dict[str, Any]:
        """转换为普通 dict。

        输入：
            无。
        输出：
            返回可放入 StreamEvent metadata 的字典。
        """
        return asdict(self)


@dataclass(slots=True)
class KnowledgeMatch:
    """保存知识库原题匹配结果。

    输入：
        matched: 是否确认命中原题。
        score: 检索候选的最高相似度。
        reason: 判定命中或未命中的原因。
        content: 命中的知识库上下文。
        sources: 命中来源列表。
        kb_name: 知识库名称。
    输出：
        返回可序列化为 dict 的匹配结果。
    """

    matched: bool
    score: float = 0.0
    reason: str = ""
    content: str = ""
    sources: list[dict[str, Any]] = field(default_factory=list)
    kb_name: str = ""

    def to_dict(self) -> dict[str, Any]:
        """转换为普通 dict。

        输入：
            无。
        输出：
            返回可放入 StreamEvent metadata 的字典。
        """
        return asdict(self)


@dataclass(slots=True)
class PhotoSolvePipelineResult:
    """保存拍照解题 agent 流程的中间和最终状态。

    输入：
        extracted_problem: 图片识别后的题目信息。
        knowledge_match: 知识库原题匹配结果。
        response: 命中原题时整理出的答案。
        mode: 当前流程模式。
        metadata: 额外元信息。
    输出：
        返回给 Capability 判断是否需要 fallback 的流程结果。
    """

    extracted_problem: ExtractedProblem
    knowledge_match: KnowledgeMatch | None = None
    response: str = ""
    mode: str = "fallback_deep_solve"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_result_payload(self) -> dict[str, Any]:
        """构造统一 result payload。

        输入：
            无。
        输出：
            返回 StreamBus.result 可直接使用的字典。
        """
        return {
            "response": self.response,
            "mode": self.mode,
            "extracted_problem": self.extracted_problem.to_dict(),
            "knowledge_match": (
                self.knowledge_match.to_dict() if self.knowledge_match is not None else None
            ),
            "metadata": dict(self.metadata),
        }
