"""Knowledge-base visibility and write guards for the multi-user layer."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from deeptutor.knowledge.manager import KnowledgeBaseManager

from .context import get_current_user
from .grants import load_grant
from .models import KnowledgeResource
from .paths import get_admin_path_service, get_current_path_service

ADMIN_PREFIX = "admin:kb:"
USER_PREFIX = "user:kb:"
DEFAULT_KB_ALIASES = {"", "default", "current", "selected", "默认", "默认知识库", "当前知识库"}


@lru_cache(maxsize=128)
def _manager_for(base_dir: str) -> KnowledgeBaseManager:
    return KnowledgeBaseManager(base_dir=base_dir)


def current_kb_base_dir() -> Path:
    return get_current_path_service().get_knowledge_bases_root()


def admin_kb_base_dir() -> Path:
    return get_admin_path_service().get_knowledge_bases_root()


def current_kb_manager() -> KnowledgeBaseManager:
    return _manager_for(str(current_kb_base_dir().resolve()))


def admin_kb_manager() -> KnowledgeBaseManager:
    return _manager_for(str(admin_kb_base_dir().resolve()))


def user_kb_manager_for_current_user() -> KnowledgeBaseManager:
    return current_kb_manager()


def _strip_resource_prefix(value: str) -> tuple[str | None, str]:
    raw = str(value or "").strip()
    if raw.startswith(ADMIN_PREFIX):
        return "admin", raw[len(ADMIN_PREFIX) :]
    if raw.startswith(USER_PREFIX):
        return "user", raw[len(USER_PREFIX) :]
    return None, raw


def _assigned_admin_names() -> set[str]:
    user = get_current_user()
    if user.is_admin:
        return set()
    out: set[str] = set()
    for item in load_grant(user.id).get("knowledge_bases", []) or []:
        name = str(item.get("name") or item.get("kb_name") or "").strip()
        resource_id = str(item.get("resource_id") or item.get("id") or "")
        if resource_id.startswith(ADMIN_PREFIX):
            name = resource_id[len(ADMIN_PREFIX) :]
        if name:
            out.add(name)
    return out


def resolve_kb(kb_ref: str, *, require_write: bool = False) -> KnowledgeResource:
    user = get_current_user()
    requested_source, name = _strip_resource_prefix(kb_ref)

    if user.is_admin:
        manager = admin_kb_manager()
        resolved = _resolve_default_or_name(manager, name)
        return KnowledgeResource(
            id=f"admin:kb:{resolved}",
            name=resolved,
            base_dir=admin_kb_base_dir(),
            source="admin",
            assigned=False,
            read_only=False,
        )

    user_manager = user_kb_manager_for_current_user()
    assigned_names = _assigned_admin_names()

    if requested_source == "admin":
        if name not in assigned_names:
            raise HTTPException(status_code=403, detail="Knowledge base is not assigned to you")
        if require_write:
            raise HTTPException(
                status_code=403, detail="Assigned admin knowledge bases are read-only"
            )
        return KnowledgeResource(
            id=f"admin:kb:{name}",
            name=name,
            base_dir=admin_kb_base_dir(),
            source="admin",
            assigned=True,
            read_only=True,
        )

    if requested_source == "user":
        resolved = _resolve_default_or_name(user_manager, name)
        return KnowledgeResource(
            id=f"user:kb:{resolved}",
            name=resolved,
            base_dir=current_kb_base_dir(),
            source="user",
            assigned=False,
            read_only=False,
        )

    if name.lower() in DEFAULT_KB_ALIASES:
        resolved = _resolve_default_or_name(user_manager, name)
        return KnowledgeResource(
            id=f"user:kb:{resolved}",
            name=resolved,
            base_dir=current_kb_base_dir(),
            source="user",
            assigned=False,
            read_only=False,
        )

    user_names = set(user_manager.list_knowledge_bases())
    if name in user_names:
        return KnowledgeResource(
            id=f"user:kb:{name}",
            name=name,
            base_dir=current_kb_base_dir(),
            source="user",
            assigned=False,
            read_only=False,
        )

    if name in assigned_names:
        if require_write:
            raise HTTPException(
                status_code=403, detail="Assigned admin knowledge bases are read-only"
            )
        return KnowledgeResource(
            id=f"admin:kb:{name}",
            name=name,
            base_dir=admin_kb_base_dir(),
            source="admin",
            assigned=True,
            read_only=True,
        )

    raise HTTPException(status_code=404, detail=f"Knowledge base '{name}' not found")


def _resolve_default_or_name(manager: KnowledgeBaseManager, name: str) -> str:
    requested = str(name or "").strip()
    names = manager.list_knowledge_bases()
    if requested and requested in names:
        return requested
    if requested.lower() in DEFAULT_KB_ALIASES:
        default_kb = manager.get_default()
        if default_kb and default_kb in names:
            return default_kb
        raise HTTPException(status_code=404, detail="No default knowledge base is configured")
    raise HTTPException(status_code=404, detail=f"Knowledge base '{requested}' not found")


def manager_for_resource(resource: KnowledgeResource) -> KnowledgeBaseManager:
    return _manager_for(str(resource.base_dir.resolve()))


def _attach_kb_info(
    item: dict[str, Any],
    manager: KnowledgeBaseManager,
    name: str,
    *,
    read_only: bool,
) -> dict[str, Any]:
    """补充当前授权知识库的展示详情。

    输入：
        item: 已确认属于当前用户可见范围的授权条目。
        manager: 指向该知识库实际目录的管理器。
        name: 知识库物理名称。
        read_only: 该知识库对当前用户是否只读。
    输出：
        返回补齐状态、统计信息、默认标记后的授权条目。
    """
    try:
        info = manager.get_info(name)
    except Exception:
        item.setdefault("statistics", {})
        item.setdefault("metadata", {})
        item.setdefault("status", "unknown")
        item.setdefault("progress", None)
        return item

    item.update(
        {
            "is_default": bool(info.get("is_default")) and not read_only,
            "statistics": info.get("statistics", {}),
            "metadata": info.get("metadata"),
            "status": info.get("status"),
            "progress": info.get("progress"),
            "path": None if read_only else info.get("path"),
        }
    )
    return item


def list_visible_knowledge_bases() -> list[dict[str, Any]]:
    """列出当前用户可见的知识库授权清单。

    输入：
        无；当前用户来自请求上下文。
    输出：
        返回当前用户自己的知识库，以及管理员授权给该用户的只读知识库。
    """
    user = get_current_user()
    manager = current_kb_manager() if user.is_admin else user_kb_manager_for_current_user()
    items: list[dict[str, Any]] = []
    for name in manager.list_knowledge_bases():
        read_only = False
        items.append(
            _attach_kb_info(
                {
                    "id": f"admin:kb:{name}" if user.is_admin else f"user:kb:{name}",
                    "name": name,
                    "source": "admin" if user.is_admin else "user",
                    "assigned": False,
                    "read_only": read_only,
                    "provenance_label": (
                        "Created by you" if not user.is_admin else "Admin workspace"
                    ),
                },
                manager,
                name,
                read_only=read_only,
            )
        )

    if user.is_admin:
        return items

    admin_manager = admin_kb_manager()
    admin_names = set(admin_manager.list_knowledge_bases())
    existing_ids = {item["id"] for item in items}
    for grant_item in load_grant(user.id).get("knowledge_bases", []) or []:
        name = str(grant_item.get("name") or grant_item.get("kb_name") or "").strip()
        resource_id = str(grant_item.get("resource_id") or grant_item.get("id") or "")
        if resource_id.startswith(ADMIN_PREFIX):
            name = resource_id[len(ADMIN_PREFIX) :]
        if not name:
            continue
        rid = f"admin:kb:{name}"
        if rid in existing_ids:
            continue
        read_only = True
        item = {
            "id": rid,
            "name": name,
            "source": "admin",
            "assigned": True,
            "read_only": read_only,
            "available": name in admin_names,
            "provenance_label": "Assigned by admin",
            "needs_admin_reindex": bool(grant_item.get("needs_admin_reindex", False)),
            "embedding_signature": grant_item.get("embedding_signature", ""),
        }
        if item["available"]:
            item = _attach_kb_info(item, admin_manager, name, read_only=read_only)
        items.append(item)
    return items


def assert_writable(kb_ref: str) -> KnowledgeResource:
    return resolve_kb(kb_ref, require_write=True)


def resolve_for_rag(kb_ref: str | None) -> KnowledgeResource | None:
    if not kb_ref:
        return None
    resource = resolve_kb(kb_ref, require_write=False)
    if resource.assigned:
        from .audit import log_usage

        log_usage("knowledge_base", resource.id, "rag_query")
    return resource
