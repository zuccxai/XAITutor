"""
Two-file public memory API: SUMMARY and PROFILE.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from deeptutor.multi_user.context import get_current_user
from deeptutor.services.memory import MemoryFile, get_memory_service
from deeptutor.services.session import get_session_store

router = APIRouter()

_VALID_FILES: set[MemoryFile] = {"summary", "profile"}


def get_sqlite_session_store():
    """Backward-compatible hook for tests and legacy monkeypatches."""
    return get_session_store()


def _snap_dict(snap) -> dict:
    """构建当前用户的长期记忆响应。

    输入：
        snap: MemoryService 返回的长期记忆快照。
    输出：
        返回包含 summary、profile、更新时间和当前用户信息的响应字典。
    """
    return {
        "summary": snap.summary,
        "profile": snap.profile,
        "summary_updated_at": snap.summary_updated_at,
        "profile_updated_at": snap.profile_updated_at,
        "user": get_current_user().public_dict(),
    }


class FileUpdateRequest(BaseModel):
    file: MemoryFile
    content: str = ""


class MemoryRefreshRequest(BaseModel):
    session_id: str | None = None
    language: str = "en"


class MemoryClearRequest(BaseModel):
    file: MemoryFile | None = None


@router.get("")
async def get_memory():
    """读取当前登录用户的长期记忆。

    输入：
        无；当前用户来自认证上下文。
    输出：
        返回当前用户作用域下的 SUMMARY.md 和 PROFILE.md 内容。
    """
    return _snap_dict(get_memory_service().read_snapshot())


@router.put("")
async def update_memory(payload: FileUpdateRequest):
    """更新当前登录用户的指定长期记忆文件。

    输入：
        payload: 目标记忆文件和新内容。
    输出：
        返回更新后的当前用户长期记忆快照。
    """
    if payload.file not in _VALID_FILES:
        raise HTTPException(status_code=400, detail=f"Invalid file: {payload.file}")
    snap = get_memory_service().write_file(payload.file, payload.content)
    return {**_snap_dict(snap), "saved": True}


@router.post("/refresh")
async def refresh_memory(payload: MemoryRefreshRequest):
    """从当前用户的会话刷新长期记忆。

    输入：
        payload: 可选会话 ID 和语言。
    输出：
        返回刷新后的当前用户长期记忆快照，并标记是否发生变化。
    """
    store = get_sqlite_session_store()
    session_id = str(payload.session_id or "").strip()
    if session_id:
        session = await store.get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")

    result = await get_memory_service().refresh_from_session(
        session_id or None,
        language=payload.language,
    )
    snap = get_memory_service().read_snapshot()
    return {**_snap_dict(snap), "changed": result.changed}


@router.post("/clear")
async def clear_memory(payload: MemoryClearRequest | None = None):
    """清空当前登录用户的长期记忆。

    输入：
        payload: 可选的记忆文件类型；为空时清空全部长期记忆。
    输出：
        返回清空后的当前用户长期记忆快照。
    """
    svc = get_memory_service()
    target = payload.file if payload else None
    if target and target not in _VALID_FILES:
        raise HTTPException(status_code=400, detail=f"Invalid file: {target}")

    if target:
        snap = svc.clear_file(target)
    else:
        snap = svc.clear_memory()
    return {**_snap_dict(snap), "cleared": True}
