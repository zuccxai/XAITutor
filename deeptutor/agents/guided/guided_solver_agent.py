"""LLM agent for progressive problem-solving guidance."""

from __future__ import annotations

from typing import Any, AsyncIterator

from deeptutor.agents.base_agent import BaseAgent
from deeptutor.core.trace import build_trace_metadata, new_call_id


class GuidedSolverAgent(BaseAgent):
    """Generate a tutoring-style hint instead of a full solution by default."""

    def __init__(self, language: str = "zh", **kwargs: Any) -> None:
        super().__init__(
            module_name="guided",
            agent_name="guided_solver_agent",
            language=language,
            **kwargs,
        )

    async def process(self, *args, **kwargs) -> str:
        chunks = [chunk async for chunk in self.stream_guidance(*args, **kwargs)]
        return "".join(chunks)

    async def stream_guidance(
        self,
        *,
        problem: str,
        conversation_context: str = "",
        retrieval_context: str = "",
        memory_context: str = "",
        skills_context: str = "",
        hint_level: int | None = None,
        reveal_answer: bool = False,
        attachments: list[Any] | None = None,
    ) -> AsyncIterator[str]:
        prompts = self.prompts or {}
        system_prompt = str(prompts.get("system", "")).strip() or self._fallback_system_prompt()
        template = str(prompts.get("user_template", "")).strip() or self._fallback_user_template()
        user_prompt = template.format(
            problem=problem,
            conversation_context=conversation_context or "(none)",
            retrieval_context=retrieval_context or "(none)",
            memory_context=memory_context or "(none)",
            skills_context=skills_context or "(none)",
            hint_level=hint_level if hint_level is not None else "auto",
            reveal_answer="yes" if reveal_answer else "no",
        )
        trace_meta = build_trace_metadata(
            call_id=new_call_id("guided"),
            phase="hinting",
            label="Generate guided response",
            call_kind="llm_final_response",
            trace_role="response",
            trace_group="stage",
        )
        async for chunk in self.stream_llm(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1600 if not reveal_answer else 2400,
            stage="hinting",
            attachments=attachments,
            trace_meta=trace_meta,
        ):
            yield chunk

    @staticmethod
    def _fallback_system_prompt() -> str:
        return (
            "You are a patient tutor. Decide whether the student needs a hint, "
            "a concept explanation, feedback on an attempt, or a direct answer. "
            "Do not force a fixed response template."
        )

    @staticmethod
    def _fallback_user_template() -> str:
        return (
            "Problem:\n{problem}\n\n"
            "Conversation context:\n{conversation_context}\n\n"
            "Retrieved knowledge and similar solved questions:\n{retrieval_context}\n\n"
            "Guidance preference: {hint_level}\nReveal answer: {reveal_answer}\n\n"
            "Respond naturally to the student's current need. If they ask a concept "
            "question, explain the concept directly. If they are solving the problem, "
            "give the next useful hint without revealing the final answer unless requested."
        )
