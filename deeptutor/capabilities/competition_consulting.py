"""Competition consulting capability."""

from __future__ import annotations

from typing import Any

from deeptutor.agents.competition_consulting import CompetitionConsultingAgent
from deeptutor.capabilities.request_contracts import get_capability_request_schema
from deeptutor.core.capability_protocol import BaseCapability, CapabilityManifest
from deeptutor.core.context import UnifiedContext
from deeptutor.core.stream_bus import StreamBus


class CompetitionConsultingCapability(BaseCapability):
    manifest = CapabilityManifest(
        name="competition_consulting",
        description="竞赛咨询：回答竞赛备赛、学习经历、金牌路径和训练规划问题。",
        stages=["retrieving", "responding"],
        tools_used=["rag", "web_search"],
        cli_aliases=["competition", "contest"],
        request_schema=get_capability_request_schema("competition_consulting"),
    )

    async def run(self, context: UnifiedContext, stream: StreamBus) -> None:
        enabled_tools = set(context.enabled_tools or [])
        kb_name = context.knowledge_bases[0] if context.knowledge_bases else None
        enable_rag = "rag" in enabled_tools and bool(kb_name)
        enable_web_search = "web_search" in enabled_tools

        # The module currently ships only a Chinese prompt, so keep runtime
        # language fixed to avoid an English output directive fighting it.
        agent = CompetitionConsultingAgent(language="zh")

        if "rag" in enabled_tools and not kb_name:
            await stream.progress(
                "已启用 RAG，但当前没有选择知识库，本轮将跳过知识库检索。",
                source=self.name,
                stage="retrieving",
                metadata={"reason": "rag_without_kb"},
            )
        elif enable_rag:
            await stream.progress(
                f"正在检索竞赛知识库：{kb_name}",
                source=self.name,
                stage="retrieving",
            )

        result_payload: dict[str, Any] = {}
        result_stream = await agent.process(
            message=context.user_message,
            history=context.conversation_history,
            kb_name=kb_name,
            enable_rag=enable_rag,
            enable_web_search=enable_web_search,
            stream=True,
            attachments=context.attachments,
        )

        async with stream.stage("responding", source=self.name):
            async for event in result_stream:
                if event.get("type") == "chunk":
                    await stream.content(
                        str(event.get("content", "")),
                        source=self.name,
                        stage="responding",
                    )
                elif event.get("type") == "complete":
                    result_payload = event

        sources = result_payload.get("sources", {}) or {}
        source_items = self._flatten_sources(sources)
        if source_items:
            await stream.sources(source_items, source=self.name, stage="responding")

        await stream.result(
            {
                "response": str(result_payload.get("response", "") or ""),
                "sources": sources,
                "truncated_history": result_payload.get("truncated_history", []),
            },
            source=self.name,
        )

    @staticmethod
    def _flatten_sources(sources: dict[str, Any]) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for item in sources.get("rag", []) or []:
            if isinstance(item, dict):
                items.append({"source": "rag", **item})
        for item in sources.get("web", []) or []:
            if isinstance(item, dict):
                items.append({"source": "web", **item})
        return items


__all__ = ["CompetitionConsultingCapability"]
