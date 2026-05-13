"""
Competition consulting module.

This package contains the agent implementation. The server-facing capability
wrapper lives in ``deeptutor.capabilities.competition_consulting``. Direct use:

    from deeptutor.agents.competition_consulting import CompetitionConsultingAgent
"""

from .competition_consulting_agent import CompetitionConsultingAgent

__all__ = ["CompetitionConsultingAgent"]
