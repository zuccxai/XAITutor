"""
Deep Guided Capability
======================

Step-by-step tutoring guidance for a problem. Unlike ``deep_solve``, this
capability defaults to hints and thinking scaffolds instead of revealing the
full solution immediately.
"""

from __future__ import annotations

import re
from typing import Any

from deeptutor.capabilities.request_contracts import get_capability_request_schema
from deeptutor.core.capability_protocol import BaseCapability, CapabilityManifest
from deeptutor.core.context import UnifiedContext
from deeptutor.core.stream_bus import StreamBus
from deeptutor.core.trace import merge_trace_metadata


def _clip_text(value: Any, limit: int = 3000) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "\n...[truncated]"


def _match_tokens(value: str) -> set[str]:
    text = str(value or "").lower()
    tokens = set(re.findall(r"[a-z0-9]+", text))
    cjk_chars = [ch for ch in text if "\u4e00" <= ch <= "\u9fff"]
    tokens.update(cjk_chars)
    tokens.update("".join(cjk_chars[i : i + 2]) for i in range(max(0, len(cjk_chars) - 1)))
    return {token for token in tokens if token.strip()}


def _score_match(query: str, candidate: str) -> int:
    query_tokens = _match_tokens(query)
    if not query_tokens:
        return 0
    candidate_tokens = _match_tokens(candidate)
    return len(query_tokens & candidate_tokens)


def _retrieval_query(context: UnifiedContext) -> str:
    message = str(context.user_message or "").strip()
    marker = "[User Question]"
    if marker in message:
        tail = message.rsplit(marker, 1)[-1].strip()
        if tail:
            return tail
    return message


def _format_question_bank_entry(entry: dict[str, Any], index: int) -> str:
    lines = [f"### Similar question {index}"]
    title = str(entry.get("session_title") or "").strip()
    if title:
        lines.append(f"Source session: {title}")
    difficulty = str(entry.get("difficulty") or "").strip()
    qtype = str(entry.get("question_type") or "").strip()
    if difficulty or qtype:
        lines.append(f"Metadata: {', '.join(part for part in [qtype, difficulty] if part)}")
    lines.extend(["Question:", _clip_text(entry.get("question"), limit=1200)])
    options = entry.get("options") or {}
    if isinstance(options, dict) and options:
        option_lines = [f"{key}. {value}" for key, value in sorted(options.items()) if value]
        if option_lines:
            lines.extend(["Options:", "\n".join(option_lines)])
    answer = str(entry.get("correct_answer") or "").strip()
    if answer:
        lines.extend(["Reference answer:", _clip_text(answer, limit=800)])
    explanation = str(entry.get("explanation") or "").strip()
    if explanation:
        lines.extend(["Explanation:", _clip_text(explanation, limit=1600)])
    return "\n".join(lines)


class DeepGuidedCapability(BaseCapability):
    manifest = CapabilityManifest(
        name="deep_guided",
        description="Guided problem solving with progressive hints.",
        stages=["understanding", "strategy", "hinting", "checking"],
        tools_used=["rag", "reason"],
        cli_aliases=["guide", "guided"],
        request_schema=get_capability_request_schema("deep_guided"),
    )

    async def run(self, context: UnifiedContext, stream: StreamBus) -> None:
        from deeptutor.agents.guided.guided_solver_agent import GuidedSolverAgent
        from deeptutor.capabilities._answer_now import extract_answer_now_context

        answer_now_payload = extract_answer_now_context(context)
        if answer_now_payload is not None:
            await self._run_answer_now(context, stream, answer_now_payload)
            return

        raw_hint_level = context.config_overrides.get("hint_level")
        hint_level = None
        if raw_hint_level is not None:
            hint_level = max(1, min(int(raw_hint_level), 4))
        reveal_answer = bool(context.config_overrides.get("reveal_answer", False))

        agent = GuidedSolverAgent(language=context.language)
        agent.set_trace_callback(self._build_trace_bridge(stream))

        async with stream.stage("understanding", source=self.name):
            await stream.progress(
                "Reading the conversation and choosing the right tutoring move...",
                source=self.name,
                stage="understanding",
                metadata={"hint_level": hint_level, "reveal_answer": reveal_answer},
            )

        retrieval_context = await self._build_retrieval_context(context, stream)

        chunks: list[str] = []
        async with stream.stage("hinting", source=self.name):
            async for chunk in agent.stream_guidance(
                problem=context.user_message,
                conversation_context=str(
                    context.metadata.get("conversation_context_text", "") or ""
                ).strip(),
                retrieval_context=retrieval_context,
                memory_context=context.memory_context,
                skills_context=context.skills_context,
                hint_level=hint_level,
                reveal_answer=reveal_answer,
                attachments=context.attachments,
            ):
                chunks.append(chunk)
                await stream.content(chunk, source=self.name, stage="hinting")

        response = "".join(chunks).strip()
        await stream.result(
            {
                "response": response,
                "mode": "guided",
                "hint_level": hint_level,
                "adaptive_guidance": hint_level is None,
                "reveal_answer": reveal_answer,
                "retrieval_used": bool(retrieval_context.strip()),
            },
            source=self.name,
        )

    async def _build_retrieval_context(
        self,
        context: UnifiedContext,
        stream: StreamBus,
    ) -> str:
        blocks: list[str] = []
        question_bank_context = await self._search_question_bank(context, stream)
        if question_bank_context:
            blocks.append("[Similar Questions from Question Bank]\n" + question_bank_context)

        rag_context = await self._search_knowledge_bases(context, stream)
        if rag_context:
            blocks.append("[Knowledge Base Retrieval]\n" + rag_context)

        return "\n\n".join(blocks).strip()

    async def _search_knowledge_bases(
        self,
        context: UnifiedContext,
        stream: StreamBus,
    ) -> str:
        enabled_tools = set(
            self.manifest.tools_used if context.enabled_tools is None else context.enabled_tools
        )
        if "rag" not in enabled_tools or not context.knowledge_bases:
            return ""

        from deeptutor.runtime.registry.tool_registry import get_tool_registry

        registry = get_tool_registry()
        query = _clip_text(_retrieval_query(context), limit=1800)
        blocks: list[str] = []
        for kb_name in context.knowledge_bases[:3]:
            kb_name = str(kb_name or "").strip()
            if not kb_name:
                continue
            await stream.tool_call(
                "rag",
                {"query": query, "kb_name": kb_name},
                source=self.name,
                stage="understanding",
            )
            try:
                result = await registry.execute(
                    "rag",
                    query=query,
                    kb_name=kb_name,
                    event_sink=self._build_tool_event_sink(stream, stage="understanding"),
                )
            except Exception as exc:
                await stream.progress(
                    f"Knowledge base retrieval skipped for {kb_name}: {exc}",
                    source=self.name,
                    stage="understanding",
                    metadata={"trace_kind": "warning", "kb_name": kb_name},
                )
                continue

            content = _clip_text(result.content, limit=3000)
            if not content:
                continue
            await stream.tool_result(
                "rag",
                content,
                source=self.name,
                stage="understanding",
                metadata={"kb_name": kb_name, "sources": result.sources},
            )
            blocks.append(f"### Knowledge base: {kb_name}\n{content}")

        return "\n\n".join(blocks)

    async def _search_question_bank(
        self,
        context: UnifiedContext,
        stream: StreamBus,
    ) -> str:
        try:
            from deeptutor.services.session import get_sqlite_session_store

            store = get_sqlite_session_store()
            result = await store.list_notebook_entries(limit=200)
        except Exception as exc:
            await stream.progress(
                f"Question bank search skipped: {exc}",
                source=self.name,
                stage="understanding",
                metadata={"trace_kind": "warning"},
            )
            return ""

        entries = result.get("items", []) if isinstance(result, dict) else []
        scored: list[tuple[int, dict[str, Any]]] = []
        query = _retrieval_query(context)
        for entry in entries:
            candidate = "\n".join(
                str(entry.get(key) or "")
                for key in ("question", "correct_answer", "explanation", "difficulty")
            )
            score = _score_match(query, candidate)
            if score > 0:
                scored.append((score, entry))

        scored.sort(key=lambda item: item[0], reverse=True)
        top_entries = [entry for score, entry in scored[:3] if score >= 2]
        if not top_entries:
            return ""

        await stream.progress(
            f"Found {len(top_entries)} similar question(s) in the question bank.",
            source=self.name,
            stage="understanding",
            metadata={
                "trace_kind": "retrieval",
                "retrieval_source": "question_bank",
                "entry_ids": [entry.get("id") for entry in top_entries],
            },
        )
        return "\n\n".join(
            _format_question_bank_entry(entry, index=i)
            for i, entry in enumerate(top_entries, start=1)
        )

    def _build_tool_event_sink(self, stream: StreamBus, *, stage: str):
        async def _event_sink(
            event_type: str,
            message: str = "",
            metadata: dict[str, Any] | None = None,
        ) -> None:
            await stream.progress(
                message,
                source=self.name,
                stage=stage,
                metadata=merge_trace_metadata(
                    metadata or {},
                    {"trace_kind": "tool_log", "tool_event_type": event_type},
                ),
            )

        return _event_sink

    async def _run_answer_now(
        self,
        context: UnifiedContext,
        stream: StreamBus,
        payload: dict[str, Any],
    ) -> None:
        from deeptutor.capabilities._answer_now import (
            build_answer_now_trace_metadata,
            format_trace_summary,
            join_chunks,
            labeled_block,
            load_answer_now_prompts,
            make_skip_notice,
            stream_synthesis,
        )

        original = str(payload.get("original_user_message") or context.user_message).strip()
        partial = str(payload.get("partial_response") or "").strip()
        trace_summary = format_trace_summary(payload.get("events"), language=context.language)

        prompts = load_answer_now_prompts("guided", context.language)
        system_prompt = str(prompts.get("system", "")).strip()
        user_prompt = str(prompts.get("user_template", "")).format(
            original=original,
            current_draft=labeled_block("Current Draft", partial),
            execution_trace=labeled_block("Execution Trace", trace_summary),
        )
        trace_meta = build_answer_now_trace_metadata(
            capability=self.name,
            phase="hinting",
            label="Answer now",
        )
        notice = make_skip_notice(
            capability=self.name,
            language=context.language,
            stages_skipped=["understanding", "strategy"],
        )

        async with stream.stage("hinting", source=self.name, metadata=trace_meta):
            if notice:
                await stream.content(notice + "\n\n", source=self.name, stage="hinting")
            chunks: list[str] = []
            async for chunk in stream_synthesis(
                stream=stream,
                source=self.name,
                stage="hinting",
                trace_meta=trace_meta,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=1800,
            ):
                chunks.append(chunk)

        guidance = join_chunks(chunks)
        full = (notice + "\n\n" + guidance).strip() if notice else guidance
        await stream.result(
            {"response": full, "mode": "guided", "metadata": {"answer_now": True}},
            source=self.name,
        )

    def _build_trace_bridge(self, stream: StreamBus):
        async def _trace_bridge(update: dict[str, Any]) -> None:
            event = str(update.get("event", "") or "")
            stage = str(update.get("phase") or update.get("stage") or "hinting")
            base_metadata = {
                key: value
                for key, value in update.items()
                if key not in {"event", "state", "response", "chunk"}
            }
            if event != "llm_call":
                return

            state = str(update.get("state", "running"))
            label = str(base_metadata.get("label") or "Generate guided response")
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
            elif state == "complete":
                await stream.progress(
                    "",
                    source=self.name,
                    stage=stage,
                    metadata=merge_trace_metadata(
                        base_metadata,
                        {"trace_kind": "call_status", "call_state": "complete"},
                    ),
                )
            elif state == "error":
                await stream.error(
                    str(update.get("response") or "Guided solve failed."),
                    source=self.name,
                    stage=stage,
                    metadata=merge_trace_metadata(
                        base_metadata,
                        {"trace_kind": "call_status", "call_state": "error"},
                    ),
                )

        return _trace_bridge
