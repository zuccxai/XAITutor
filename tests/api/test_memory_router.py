from __future__ import annotations

import importlib

import pytest

pytest.importorskip("fastapi")

FastAPI = pytest.importorskip("fastapi").FastAPI
TestClient = pytest.importorskip("fastapi.testclient").TestClient
router = importlib.import_module("deeptutor.api.routers.memory").router


def _build_app() -> FastAPI:
    """构建只挂载 memory router 的测试应用。

    输入：
        无。
    输出：
        返回 FastAPI 测试应用。
    """
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/memory")
    return app


def _make_snapshot(
    summary: str = "",
    profile: str = "",
    summary_updated_at: str | None = None,
    profile_updated_at: str | None = None,
):
    """构建长期记忆快照测试对象。

    输入：
        summary: 学习摘要内容。
        profile: 用户画像内容。
        summary_updated_at: 学习摘要更新时间。
        profile_updated_at: 用户画像更新时间。
    输出：
        返回带对应属性的轻量对象。
    """
    return type(
        "Snapshot",
        (),
        {
            "summary": summary,
            "profile": profile,
            "summary_updated_at": summary_updated_at,
            "profile_updated_at": profile_updated_at,
        },
    )()


def test_memory_router_returns_single_document(monkeypatch) -> None:
    """验证 memory API 返回中文用户画像内容。

    输入：
        monkeypatch: pytest monkeypatch fixture。
    输出：
        无；通过断言验证响应体。
    """

    class FakeMemoryService:
        def read_snapshot(self):
            """读取模拟长期记忆快照。

            输入：
                无。
            输出：
                返回包含中文用户画像的快照。
            """
            return _make_snapshot(
                profile="## 偏好\n- 用户偏好简洁回答。",
                profile_updated_at="2026-03-13T12:00:00+08:00",
            )

    monkeypatch.setattr(
        "deeptutor.api.routers.memory.get_memory_service", lambda: FakeMemoryService()
    )

    with TestClient(_build_app()) as client:
        response = client.get("/api/v1/memory")

    assert response.status_code == 200
    body = response.json()
    assert body["profile"] == "## 偏好\n- 用户偏好简洁回答。"
    assert body["profile_updated_at"] == "2026-03-13T12:00:00+08:00"
    assert body["summary"] == ""
    assert body["summary_updated_at"] is None


def test_memory_router_refreshes_from_session(monkeypatch) -> None:
    """验证 memory API 可按中文默认刷新会话长期记忆。

    输入：
        monkeypatch: pytest monkeypatch fixture。
    输出：
        无；通过断言验证刷新响应。
    """

    class FakeStore:
        async def get_session(self, session_id: str):
            """读取模拟会话。

            输入：
                session_id: 会话标识。
            输出：
                找不到时返回 None，否则返回会话字典。
            """
            if session_id == "missing":
                return None
            return {"session_id": session_id}

    _snapshot = _make_snapshot(
        profile="## 偏好\n- 用户偏好简洁回答。",
        summary="## 当前关注\n- 正在完善长期记忆。",
        profile_updated_at="2026-03-13T12:10:00+08:00",
        summary_updated_at="2026-03-13T12:10:00+08:00",
    )

    class FakeMemoryService:
        async def refresh_from_session(self, session_id, language="zh"):
            """模拟从会话刷新长期记忆。

            输入：
                session_id: 会话标识。
                language: 刷新语言参数。
            输出：
                返回 changed 为 True 的结果对象。
            """
            assert language == "zh"
            return type("Result", (), {"changed": True})()

        def read_snapshot(self):
            """读取模拟长期记忆快照。

            输入：
                无。
            输出：
                返回中文长期记忆快照。
            """
            return _snapshot

    monkeypatch.setattr(
        "deeptutor.api.routers.memory.get_sqlite_session_store", lambda: FakeStore()
    )
    monkeypatch.setattr(
        "deeptutor.api.routers.memory.get_memory_service", lambda: FakeMemoryService()
    )

    with TestClient(_build_app()) as client:
        response = client.post(
            "/api/v1/memory/refresh",
            json={"session_id": "unified_1"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["changed"] is True
    assert "正在完善长期记忆" in body["summary"]
    assert "简洁回答" in body["profile"]


def test_memory_router_updates_document(monkeypatch) -> None:
    """验证 memory API 可保存中文用户画像内容。

    输入：
        monkeypatch: pytest monkeypatch fixture。
    输出：
        无；通过断言验证保存响应。
    """

    class FakeMemoryService:
        def write_file(self, which, content: str):
            """写入模拟长期记忆文件。

            输入：
                which: 记忆文件类型。
                content: 要保存的内容。
            输出：
                返回模拟快照。
            """
            return _make_snapshot(
                profile=content if which == "profile" else "",
                profile_updated_at="2026-03-13T12:20:00+08:00",
            )

    monkeypatch.setattr(
        "deeptutor.api.routers.memory.get_memory_service", lambda: FakeMemoryService()
    )

    with TestClient(_build_app()) as client:
        response = client.put(
            "/api/v1/memory",
            json={"file": "profile", "content": "## 偏好\n- 用户偏好简洁回答。"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["saved"] is True
    assert body["profile"] == "## 偏好\n- 用户偏好简洁回答。"
