"""双文件长期记忆系统：SUMMARY.md 和 PROFILE.md。

- SUMMARY: 用户学习旅程摘要，由系统自动更新。
- PROFILE: 用户身份、偏好、知识水平，由系统自动更新。

每个 bot 独立的 SOUL.md、TOOLS.md、USER.md 等文件保存在各自工作区，
不放在共享长期记忆目录中。
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
import logging
from pathlib import Path
import re
from typing import Literal

from deeptutor.services.llm import clean_thinking_tags
from deeptutor.services.llm import stream as llm_stream
from deeptutor.services.path_service import PathService, get_path_service
from deeptutor.services.session.sqlite_store import SQLiteSessionStore, get_sqlite_session_store

MemoryFile = Literal["summary", "profile"]
MEMORY_FILES: list[MemoryFile] = ["summary", "profile"]

_NO_CHANGE = "NO_CHANGE"

logger = logging.getLogger(__name__)

_FILENAMES: dict[MemoryFile, str] = {
    "summary": "SUMMARY.md",
    "profile": "PROFILE.md",
}


@dataclass
class MemorySnapshot:
    summary: str
    profile: str
    summary_updated_at: str | None
    profile_updated_at: str | None


@dataclass
class MemoryUpdateResult:
    content: str
    changed: bool
    updated_at: str | None


class MemoryService:
    """双文件公开长期记忆：SUMMARY + PROFILE。"""

    def __init__(
        self,
        path_service: PathService | None = None,
        store: SQLiteSessionStore | None = None,
    ) -> None:
        self._path_service = path_service or get_path_service()
        self._store = store or get_sqlite_session_store()
        self._refresh_lock = asyncio.Lock()
        self._migrate_legacy()

    @property
    def _memory_dir(self) -> Path:
        return self._path_service.get_memory_dir()

    def _path(self, which: MemoryFile) -> Path:
        return self._memory_dir / _FILENAMES[which]

    def _migrate_legacy(self) -> None:
        """从旧版 memory.md 一次性迁移到双文件系统。

        输入：
            无。
        输出：
            无；必要时写入 PROFILE.md、SUMMARY.md 并备份旧文件。
        """
        legacy = self._memory_dir / "memory.md"
        if not legacy.exists():
            return
        if self._path("profile").exists() or self._path("summary").exists():
            return

        content = legacy.read_text(encoding="utf-8").strip()
        if not content:
            legacy.rename(legacy.with_suffix(".md.bak"))
            return

        preferences, context = self._extract_legacy_sections(content)
        self._memory_dir.mkdir(parents=True, exist_ok=True)
        if preferences:
            self._path("profile").write_text(
                f"## 偏好\n{preferences}",
                encoding="utf-8",
            )
        if context:
            self._path("summary").write_text(
                f"## 学习旅程\n{context}",
                encoding="utf-8",
            )
        legacy.rename(legacy.with_suffix(".md.bak"))

    def read_file(self, which: MemoryFile) -> str:
        """读取指定长期记忆文件。

        输入：
            which: 记忆文件类型，取值为 summary 或 profile。
        输出：
            返回清理后的 Markdown 内容；文件不存在或读取失败时返回空字符串。
        """
        path = self._path(which)
        if not path.exists():
            return ""
        try:
            raw = path.read_text(encoding="utf-8").strip()
            cleaned = _clean_memory_content(raw)
            if cleaned != raw:
                try:
                    if cleaned:
                        path.write_text(cleaned, encoding="utf-8")
                    else:
                        path.unlink()
                except Exception:
                    pass
            return cleaned
        except Exception:
            return ""

    def read_summary(self) -> str:
        """读取学习旅程摘要。

        输入：
            无。
        输出：
            返回 SUMMARY.md 内容；不存在时返回空字符串。
        """
        return self.read_file("summary")

    def read_profile(self) -> str:
        """读取用户画像。

        输入：
            无。
        输出：
            返回 PROFILE.md 内容；不存在时返回空字符串。
        """
        return self.read_file("profile")

    def _file_updated_at(self, which: MemoryFile) -> str | None:
        """读取记忆文件更新时间。

        输入：
            which: 记忆文件类型，取值为 summary 或 profile。
        输出：
            返回 ISO 格式更新时间；文件不存在或读取失败时返回 None。
        """
        path = self._path(which)
        if not path.exists():
            return None
        try:
            return datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat()
        except Exception:
            return None

    def read_snapshot(self) -> MemorySnapshot:
        """读取两份长期记忆快照。

        输入：
            无。
        输出：
            返回包含 summary、profile 及更新时间的 MemorySnapshot。
        """
        return MemorySnapshot(
            summary=self.read_summary(),
            profile=self.read_profile(),
            summary_updated_at=self._file_updated_at("summary"),
            profile_updated_at=self._file_updated_at("profile"),
        )

    def write_file(self, which: MemoryFile, content: str) -> MemorySnapshot:
        """写入指定长期记忆文件。

        输入：
            which: 记忆文件类型，取值为 summary 或 profile。
            content: 要写入的 Markdown 内容。
        输出：
            返回写入后的长期记忆快照。
        """
        normalized = _clean_memory_content(str(content or ""))
        path = self._path(which)
        path.parent.mkdir(parents=True, exist_ok=True)
        if not normalized:
            if path.exists():
                path.unlink()
        else:
            path.write_text(normalized, encoding="utf-8")
        return self.read_snapshot()

    def write_memory(self, content: str) -> MemorySnapshot:
        """兼容旧接口：写入用户画像。

        输入：
            content: 要写入 PROFILE.md 的 Markdown 内容。
        输出：
            返回写入后的长期记忆快照。
        """
        return self.write_file("profile", content)

    def clear_file(self, which: MemoryFile) -> MemorySnapshot:
        """清空指定长期记忆文件。

        输入：
            which: 记忆文件类型，取值为 summary 或 profile。
        输出：
            返回清空后的长期记忆快照。
        """
        return self.write_file(which, "")

    def clear_memory(self) -> MemorySnapshot:
        """清空全部长期记忆。

        输入：
            无。
        输出：
            返回清空后的长期记忆快照。
        """
        for f in MEMORY_FILES:
            path = self._path(f)
            if path.exists():
                path.unlink()
        return self.read_snapshot()

    def build_memory_context(
        self,
        files: list[MemoryFile] | None = None,
        max_chars: int = 4000,
    ) -> str:
        """构建注入对话的长期记忆上下文。

        输入：
            files: 需要读取的长期记忆文件类型。
            max_chars: 最多注入的字符数。
        输出：
            返回中文标题组织的长期记忆上下文；没有可用记忆时返回空字符串。
        """
        requested = {item for item in files or [] if item in MEMORY_FILES}
        if not requested:
            return ""

        parts: list[str] = []

        profile = self.read_profile() if "profile" in requested else ""
        if profile:
            parts.append(f"### 用户画像\n{profile}")

        summary = self.read_summary() if "summary" in requested else ""
        if summary:
            parts.append(f"### 学习上下文\n{summary}")

        if not parts:
            return ""

        combined = "\n\n".join(parts)
        if len(combined) > max_chars:
            combined = combined[:max_chars].rstrip() + "\n...[已截断]"

        return (
            "## 背景记忆\n"
            "仅在与当前问题直接相关时使用这些记忆。\n\n"
            f"{combined}"
        )

    def get_preferences_text(self) -> str:
        """读取用户画像文本。

        输入：
            无。
        输出：
            返回带中文标题的用户画像文本；没有画像时返回空字符串。
        """
        profile = self.read_profile()
        return f"## 用户画像\n{profile}" if profile else ""

    async def refresh_from_turn(
        self,
        *,
        user_message: str,
        assistant_message: str,
        session_id: str = "",
        capability: str = "",
        language: str = "zh",
        timestamp: str = "",
    ) -> MemoryUpdateResult:
        """基于单轮对话刷新长期记忆。

        输入：
            user_message: 用户本轮消息。
            assistant_message: 助手本轮回复。
            session_id: 当前会话标识。
            capability: 当前能力名称。
            language: 调用方语言偏好；长期记忆仍固定使用中文记录。
            timestamp: 可选时间戳。
        输出：
            返回 MemoryUpdateResult，标识长期记忆是否发生变化。
        """
        if not user_message.strip() or not assistant_message.strip():
            return MemoryUpdateResult(content="", changed=False, updated_at=None)

        source = (
            f"[会话] {session_id or '(unknown)'}\n"
            f"[能力] {capability or 'chat'}\n"
            f"[时间] {timestamp or datetime.now().isoformat()}\n\n"
            f"[用户]\n{user_message.strip()}\n\n"
            f"[助手]\n{assistant_message.strip()}"
        )

        async with self._refresh_lock:
            p_changed = await self._rewrite_one("profile", source, language)
            s_changed = await self._rewrite_one("summary", source, language)

            snap = self.read_snapshot()
        return MemoryUpdateResult(
            content=snap.profile,
            changed=p_changed or s_changed,
            updated_at=snap.profile_updated_at,
        )

    async def refresh_from_session(
        self,
        session_id: str | None = None,
        *,
        language: str = "zh",
        max_messages: int = 10,
    ) -> MemoryUpdateResult:
        """基于最近会话消息刷新长期记忆。

        输入：
            session_id: 目标会话标识；为空时使用最近一个会话。
            language: 调用方语言偏好；长期记忆仍固定使用中文记录。
            max_messages: 最多读取的最近消息数。
        输出：
            返回 MemoryUpdateResult，标识长期记忆是否发生变化。
        """
        target = (session_id or "").strip()
        if not target:
            sessions = await self._store.list_sessions(limit=1)
            if sessions:
                target = str(sessions[0].get("session_id", "") or "")

        if not target:
            return MemoryUpdateResult(content="", changed=False, updated_at=None)

        messages = await self._store.get_messages_for_context(target)
        relevant = [
            m
            for m in messages
            if str(m.get("role", "")) in {"user", "assistant"}
            and str(m.get("content", "") or "").strip()
        ][-max_messages:]

        if not relevant:
            return MemoryUpdateResult(content="", changed=False, updated_at=None)

        transcript = "\n\n".join(
            f"{'用户' if m.get('role') == 'user' else '助手'}: "
            f"{str(m.get('content', '') or '').strip()}"
            for m in relevant
        )

        cap = ""
        sess = await self._store.get_session(target)
        if sess:
            cap = str(sess.get("capability", "") or "")

        source = f"[会话] {target}\n[能力] {cap or 'chat'}\n\n[最近对话]\n{transcript}"

        async with self._refresh_lock:
            p_changed = await self._rewrite_one("profile", source, language)
            s_changed = await self._rewrite_one("summary", source, language)

            snap = self.read_snapshot()
        return MemoryUpdateResult(
            content=snap.profile,
            changed=p_changed or s_changed,
            updated_at=snap.profile_updated_at,
        )

    async def _rewrite_one(self, which: MemoryFile, source: str, language: str) -> bool:
        """重写单个长期记忆文件。

        输入：
            which: 记忆文件类型，取值为 summary 或 profile。
            source: 本次刷新使用的新材料。
            language: 调用方语言偏好；长期记忆固定以中文 prompt 生成。
        输出：
            返回 True 表示文件发生变化；返回 False 表示无需更新或模型输出无效。
        """
        current = self.read_file(which)

        if which == "profile":
            sys_prompt, user_prompt = self._profile_prompts(current, source)
        else:
            sys_prompt, user_prompt = self._summary_prompts(current, source)

        chunks: list[str] = []
        async for c in llm_stream(
            prompt=user_prompt,
            system_prompt=sys_prompt,
            temperature=0.2,
            max_tokens=900,
        ):
            chunks.append(c)

        raw = _clean_memory_content("".join(chunks))
        if not raw or raw == _NO_CHANGE:
            return False

        if raw == current:
            return False

        if not _is_valid_memory_rewrite(which, raw):
            logger.warning(
                "Skipping invalid %s memory rewrite: missing expected section heading",
                which,
            )
            return False

        self.write_file(which, raw)
        return True

    @staticmethod
    def _profile_prompts(current: str, source: str) -> tuple[str, str]:
        """构建用户画像重写 prompt。

        输入：
            current: 当前 PROFILE.md 内容。
            source: 本次刷新使用的新材料。
        输出：
            返回 system_prompt 和 user_prompt。
        """
        return (
            "你负责维护一份长期用户画像文档。只记录稳定的用户身份、学习方式、"
            "知识水平和偏好。输出必须使用简体中文；API、CLI、LLM、RAG、"
            "WebSocket、FastAPI、pytest、类名、函数名、路径、命令等专业术语可以保留英文。"
            f"如果无需修改，请只返回 {_NO_CHANGE}。",
            "如果需要更新，请重写完整用户画像，使用以下中文 Markdown 二级标题：\n"
            "## 身份\n## 学习方式\n## 知识水平\n## 偏好\n\n"
            "规则：保持简短，只记录长期稳定信息；删除过时内容；不要记录临时闲聊；"
            "不要使用英文标题；不要添加代码块。\n\n"
            f"[当前用户画像]\n{current or '(empty)'}\n\n"
            f"[新增材料]\n{source}",
        )

    @staticmethod
    def _summary_prompts(current: str, source: str) -> tuple[str, str]:
        """构建学习摘要重写 prompt。

        输入：
            current: 当前 SUMMARY.md 内容。
            source: 本次刷新使用的新材料。
        输出：
            返回 system_prompt 和 user_prompt。
        """
        return (
            "你负责维护一份长期学习旅程摘要。记录用户正在学习什么、已经完成什么、"
            "以及仍有哪些待解决问题。输出必须使用简体中文；API、CLI、LLM、RAG、"
            "WebSocket、FastAPI、pytest、类名、函数名、路径、命令等专业术语可以保留英文。"
            f"如果无需修改，请只返回 {_NO_CHANGE}。",
            "如果需要更新，请重写完整学习旅程摘要，使用以下中文 Markdown 二级标题：\n"
            "## 当前关注\n## 已完成\n## 待解决问题\n\n"
            "规则：保持简短；删除已不相关或过时的条目；不要使用英文标题；不要添加代码块。\n\n"
            f"[当前学习摘要]\n{current or '(empty)'}\n\n"
            f"[新增材料]\n{source}",
        )

    @staticmethod
    def _extract_legacy_sections(content: str) -> tuple[str, str]:
        """提取旧版 memory.md 中的偏好和上下文段落。

        输入：
            content: 旧版 memory.md 原文。
        输出：
            返回 preferences 和 context 两段文本。
        """
        text = content.replace("\r\n", "\n").strip()
        preferences = ""
        context = ""
        pref_match = re.search(
            r"##\s*Preferences\s*(.*?)(?=\n##\s*Context\b|\Z)",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        ctx_match = re.search(
            r"##\s*Context\s*(.*)$",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if pref_match:
            preferences = pref_match.group(1).strip()
        if ctx_match:
            context = ctx_match.group(1).strip()
        return preferences, context


def _strip_code_fence(content: str) -> str:
    """去除模型可能包裹的 Markdown 代码块。

    输入：
        content: 模型输出文本。
    输出：
        返回去掉外层代码块后的文本。
    """
    cleaned = str(content or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return cleaned.strip()


_EXPECTED_MEMORY_HEADINGS: dict[MemoryFile, set[str]] = {
    "profile": {
        "身份",
        "用户身份",
        "学习方式",
        "学习风格",
        "知识水平",
        "偏好",
        "用户偏好",
        "identity",
        "user identity",
        "learning style",
        "knowledge level",
        "preferences",
        "preference",
    },
    "summary": {
        "当前关注",
        "当前学习",
        "学习重点",
        "已完成",
        "学习成果",
        "成就",
        "待解决问题",
        "开放问题",
        "学习旅程",
        "学习上下文",
        "上下文",
        "current focus",
        "accomplishments",
        "open questions",
        "learning journey",
        "context",
    },
}


def _normalize_heading(value: str) -> str:
    """规范化 Markdown 标题文本。

    输入：
        value: 原始标题文本。
    输出：
        返回去除格式符和尾部冒号后的标题文本。
    """
    heading = re.sub(r"[*_`]+", "", str(value or "")).strip()
    heading = re.sub(r"[:：\s]+$", "", heading).strip()
    return heading.lower()


def _is_valid_memory_rewrite(which: MemoryFile, content: str) -> bool:
    """校验模型输出是否像目标长期记忆文件。

    输入：
        which: 记忆文件类型，取值为 summary 或 profile。
        content: 模型重写后的 Markdown 内容。
    输出：
        返回 True 表示至少包含一个允许的二级标题。
    """
    allowed = _EXPECTED_MEMORY_HEADINGS[which]
    headings = re.findall(r"^##(?!#)\s*(.+?)\s*$", content, flags=re.MULTILINE)
    return any(_normalize_heading(heading) in allowed for heading in headings)


def _clean_memory_content(content: str) -> str:
    """清理可持久化的长期记忆内容。

    输入：
        content: 模型输出或用户编辑内容。
    输出：
        返回去除代码块和模型思考标签后的文本。
    """
    return clean_thinking_tags(_strip_code_fence(content)).strip()


_memory_service: MemoryService | None = None


def get_memory_service() -> MemoryService:
    """获取全局长期记忆服务实例。

    输入：
        无。
    输出：
        返回 MemoryService 单例。
    """
    global _memory_service
    if _memory_service is None:
        _memory_service = MemoryService()
    return _memory_service


__all__ = [
    "MemoryFile",
    "MemoryService",
    "MemorySnapshot",
    "MemoryUpdateResult",
    "get_memory_service",
]
