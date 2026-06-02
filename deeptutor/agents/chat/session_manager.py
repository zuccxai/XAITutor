#!/usr/bin/env python
"""
SessionManager - Chat session persistence and management.

This module handles:
- Creating new chat sessions
- Updating sessions with new messages
- Retrieving session history
- Listing recent sessions
- Deleting sessions

Now inherits from BaseSessionManager for consistent behavior across all modules.
"""

from typing import Any

from deeptutor.services.path_service import get_path_service
from deeptutor.services.session import BaseSessionManager


class SessionManager(BaseSessionManager):
    """
    Manages persistent storage of chat sessions.

    Legacy JSON sessions are stored under ``data/user/workspace/chat/chat/sessions.json``.
    Each session contains:
    - session_id: Unique identifier
    - title: Session title (usually first user message)
    - messages: List of messages with role, content, sources, timestamp
    - settings: RAG/Web Search settings used
    - created_at: Creation timestamp
    - updated_at: Last update timestamp
    """

    def __init__(self):
        """Initialize SessionManager."""
        super().__init__("chat")

    # =========================================================================
    # BaseSessionManager Abstract Method Implementations
    # =========================================================================

    def _get_session_id_prefix(self) -> str:
        """Return the prefix for session IDs."""
        return "chat_"

    def _get_default_title(self) -> str:
        """Return the default title for new sessions."""
        return "New Chat"

    def _create_session_data(
        self,
        settings: dict[str, Any] | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """
        Create chat-specific session data.

        Args:
            settings: Chat settings (kb_name, enable_rag, enable_web_search)

        Returns:
            Dict with settings
        """
        return {
            "settings": settings or {},
        }

    def _get_session_summary(self, session: dict[str, Any]) -> dict[str, Any]:
        """
        Create a summary of a chat session for listing.

        Args:
            session: The full session data

        Returns:
            Dict containing summary fields
        """
        messages = session.get("messages", [])
        return {
            "session_id": session.get("session_id"),
            "title": session.get("title"),
            "message_count": len(messages),
            "settings": session.get("settings"),
            "created_at": session.get("created_at"),
            "updated_at": session.get("updated_at"),
            # Include preview of last message
            "last_message": (messages[-1].get("content", "")[:100] if messages else ""),
        }

    # =========================================================================
    # Chat-Specific Methods
    # =========================================================================

    def create_session(
        self,
        title: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Create a new chat session.

        Args:
            title: Session title (uses default if None)
            settings: Optional settings (kb_name, enable_rag, enable_web_search)

        Returns:
            New session dict with session_id
        """
        return super().create_session(
            title=title,
            settings=settings,
        )

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        sources: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """
        Add a single message to a session.

        Args:
            session_id: Session identifier
            role: Message role ('user' or 'assistant')
            content: Message content
            sources: Optional sources dict (for assistant messages)

        Returns:
            Updated session or None if not found
        """
        return super().add_message(
            session_id=session_id,
            role=role,
            content=content,
            sources=sources,
        )

    def update_session(
        self,
        session_id: str,
        messages: list[dict[str, Any]] | None = None,
        title: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """
        Update a session with new data.

        Args:
            session_id: Session identifier
            messages: New messages list (replaces existing)
            title: New title (optional)
            settings: New settings (optional)

        Returns:
            Updated session or None if not found
        """
        return super().update_session(
            session_id=session_id,
            messages=messages,
            title=title,
            settings=settings,
        )


# 按 workspace 路径缓存实例；多用户模式下认证后 PathService 会切换，
# 进程级单例会把普通用户和管理员 workspace 混在一起。
_session_managers: dict[str, SessionManager] = {}


def get_session_manager() -> SessionManager:
    """获取当前用户作用域下的 Chat 会话管理器。

    输入：
        无；当前用户来自请求上下文。
    输出：
        返回绑定到当前用户 sessions.json 的 SessionManager。
    """
    key = str(get_path_service().get_chat_session_file().resolve())
    manager = _session_managers.get(key)
    if manager is None:
        manager = SessionManager()
        _session_managers[key] = manager
    return manager


__all__ = ["SessionManager", "get_session_manager"]
