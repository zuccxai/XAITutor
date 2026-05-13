#!/usr/bin/env python
"""
CompetitionConsultingAgent - contest preparation and learning-path consulting.

The implementation follows the legacy ChatAgent shape:
- BaseAgent for provider/config/prompt loading
- optional RAG and web-search context retrieval
- history truncation
- streaming and non-streaming response modes

The server-facing integration lives in
deeptutor.capabilities.competition_consulting.
"""

from __future__ import annotations

from typing import Any, AsyncGenerator

from deeptutor.agents.base_agent import BaseAgent
from deeptutor.runtime.registry.tool_registry import get_tool_registry
from deeptutor.services.prompt.language import append_language_directive


class CompetitionConsultingAgent(BaseAgent):
    """
    Advisory agent for contest preparation questions.

    Typical use cases:
    - Roadmaps for math, physics, informatics, and science competitions
    - Learning-experience questions such as "how did strong contestants train?"
    - Gold-medal-path planning, milestone checks, and resource sequencing
    - Problem-solving strategy, review loops, and parent/coach communication
    """

    DEFAULT_MAX_HISTORY_TOKENS = 5000
    DEFAULT_SOURCE_PREVIEW_CHARS = 600

    def __init__(
        self,
        language: str = "zh",
        config: dict[str, Any] | None = None,
        max_history_tokens: int | None = None,
        default_kb_name: str | None = None,
        **kwargs: Any,
    ) -> None:
        """
        Initialize the competition consulting agent.

        Args:
            language: Language setting ("zh" or "en").
            config: Optional runtime config dictionary.
            max_history_tokens: Maximum tokens retained from prior turns.
            default_kb_name: Optional default competition knowledge base.
            **kwargs: Additional BaseAgent arguments.
        """
        super().__init__(
            module_name="competition_consulting",
            agent_name="competition_consulting_agent",
            language=language,
            config=config,
            **kwargs,
        )

        self.max_history_tokens = max_history_tokens or self.agent_config.get(
            "max_history_tokens",
            self.DEFAULT_MAX_HISTORY_TOKENS,
        )
        self.default_kb_name = (
            default_kb_name
            or self.agent_config.get("default_kb_name")
            or self.agent_config.get("competition_kb_name")
            or ""
        )
        self.enable_rag_by_default = bool(self.agent_config.get("enable_rag_by_default", True))
        self._tool_registry = get_tool_registry()

        self.logger.info(
            "CompetitionConsultingAgent initialized: model=%s, default_kb=%s",
            self.model,
            self.default_kb_name or "(none)",
        )

    def count_tokens(self, text: str) -> int:
        """Count tokens with tiktoken, falling back to a rough estimate."""
        try:
            import tiktoken

            encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
        except ImportError:
            return len(text) // 4

    def truncate_history(
        self,
        history: list[dict[str, str]],
        max_tokens: int | None = None,
    ) -> list[dict[str, str]]:
        """Keep the most recent messages within the token budget."""
        max_tokens = max_tokens or self.max_history_tokens
        if not history:
            return []

        message_tokens = [
            (msg, self.count_tokens(str(msg.get("content", "")))) for msg in history
        ]

        truncated: list[dict[str, str]] = []
        total_tokens = 0
        for msg, tokens in reversed(message_tokens):
            if total_tokens + tokens > max_tokens:
                break
            truncated.insert(0, msg)
            total_tokens += tokens

        if len(truncated) < len(history):
            self.logger.info(
                "Truncated competition consulting history from %d to %d messages (%d tokens)",
                len(history),
                len(truncated),
                total_tokens,
            )
        return truncated

    async def retrieve_context(
        self,
        message: str,
        kb_name: str | None = None,
        enable_rag: bool | None = None,
        enable_web_search: bool = False,
    ) -> tuple[str, dict[str, Any]]:
        """
        Retrieve optional reference context from RAG and/or web search.

        RAG is intended for curated competition material, such as alumni
        interviews, training logs, curriculum maps, book lists, and contest
        preparation retrospectives.
        """
        use_rag = self.enable_rag_by_default if enable_rag is None else enable_rag
        selected_kb = self._resolve_kb_name(kb_name)
        context_parts: list[str] = []
        sources: dict[str, Any] = {"rag": [], "web": [], "warnings": []}

        if use_rag and selected_kb:
            retrieval_query = self.build_retrieval_query(message=message)
            try:
                self.logger.info(
                    "Competition RAG search: kb=%s, query=%s...",
                    selected_kb,
                    retrieval_query[:80],
                )
                rag_result = await self._tool_registry.execute(
                    "rag",
                    query=retrieval_query,
                    kb_name=selected_kb,
                    mode="hybrid",
                )
                rag_answer = rag_result.content
                if rag_answer:
                    context_parts.append(
                        f"[Competition Knowledge Base: {selected_kb}]\n{rag_answer}"
                    )
                    sources["rag"].append(
                        {
                            "kb_name": selected_kb,
                            "query": retrieval_query,
                            "content": self._preview(rag_answer),
                        }
                    )
            except Exception as exc:
                warning = f"RAG search failed: {exc}"
                self.logger.warning(warning)
                sources["warnings"].append(warning)
        elif use_rag and not selected_kb:
            sources["warnings"].append("RAG enabled but no competition knowledge base selected")

        if enable_web_search:
            try:
                web_result = await self._tool_registry.execute(
                    "web_search",
                    query=message,
                    verbose=False,
                )
                web_answer = web_result.content
                if web_answer:
                    context_parts.append(f"[Web Search Results]\n{web_answer}")
                    sources["web"] = web_result.sources[:5]
            except Exception as exc:
                warning = f"Web search failed: {exc}"
                self.logger.warning(warning)
                sources["warnings"].append(warning)

        return "\n\n".join(context_parts), sources

    def build_retrieval_query(
        self,
        message: str,
    ) -> str:
        """Build a RAG query that preserves the user's contest consulting intent."""
        parts = [
            "domain: academic competition consulting",
            f"user question: {message}",
        ]
        return "\n".join(parts)[:1200]

    def build_messages(
        self,
        message: str,
        history: list[dict[str, str]],
        context: str = "",
    ) -> list[dict[str, str]]:
        """Build the LLM message array."""
        system_prompt = append_language_directive(
            self.get_prompt("system", "You are a contest preparation advisor."),
            self.language,
        )
        system_parts = [system_prompt]

        if context:
            context_template = self.get_prompt(
                "context_template",
                "Reference context:\n{context}",
            )
            system_parts.append(context_template.format(context=context))

        messages: list[dict[str, str]] = [
            {"role": "system", "content": "\n\n".join(system_parts)}
        ]

        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant"):
                messages.append({"role": role, "content": content})

        user_template = self.get_prompt("user_template", "{message}")
        messages.append(
            {
                "role": "user",
                "content": user_template.format(message=message),
            }
        )
        return messages

    async def generate_stream(
        self,
        messages: list[dict[str, Any]],
        attachments: list[Any] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response through BaseAgent.stream_llm."""
        system_prompt, user_prompt = self._extract_prompts(messages)
        async for chunk in self.stream_llm(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            messages=messages,
            stage="competition_consulting_stream",
            attachments=attachments,
        ):
            yield chunk

    async def generate(
        self,
        messages: list[dict[str, Any]],
        attachments: list[Any] | None = None,
    ) -> str:
        """Generate a complete non-streaming response."""
        system_prompt, user_prompt = self._extract_prompts(messages)
        return await self.call_llm(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            messages=messages,
            stage="competition_consulting",
            attachments=attachments,
        )

    async def process(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        kb_name: str | None = None,
        enable_rag: bool | None = None,
        enable_web_search: bool = False,
        stream: bool = False,
        attachments: list[Any] | None = None,
    ) -> dict[str, Any] | AsyncGenerator[dict[str, Any], None]:
        """Process a competition consulting request."""
        history = history or []
        truncated_history = self.truncate_history(history)

        context, sources = await self.retrieve_context(
            message=message,
            kb_name=kb_name,
            enable_rag=enable_rag,
            enable_web_search=enable_web_search,
        )

        messages = self.build_messages(
            message=message,
            history=truncated_history,
            context=context,
        )

        if stream:

            async def stream_generator() -> AsyncGenerator[dict[str, Any], None]:
                full_response = ""
                async for chunk in self.generate_stream(messages, attachments=attachments):
                    full_response += chunk
                    yield {"type": "chunk", "content": chunk}

                yield {
                    "type": "complete",
                    "response": full_response,
                    "sources": sources,
                    "truncated_history": truncated_history,
                }

            return stream_generator()

        response = await self.generate(messages, attachments=attachments)
        return {
            "response": response,
            "sources": sources,
            "truncated_history": truncated_history,
        }

    def _resolve_kb_name(self, kb_name: str | None) -> str:
        return (kb_name or self.default_kb_name or "").strip()

    def _preview(self, content: str, limit: int | None = None) -> str:
        limit = limit or self.DEFAULT_SOURCE_PREVIEW_CHARS
        cleaned = " ".join(str(content or "").split())
        if len(cleaned) <= limit:
            return cleaned
        return cleaned[: limit - 3].rstrip() + "..."

    @staticmethod
    def _extract_prompts(messages: list[dict[str, Any]]) -> tuple[str, str]:
        system_prompt = ""
        user_prompt = ""
        for msg in messages:
            if msg.get("role") == "system":
                system_prompt = str(msg.get("content", ""))
                break
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_prompt = str(msg.get("content", ""))
                break
        return system_prompt, user_prompt


__all__ = ["CompetitionConsultingAgent"]
