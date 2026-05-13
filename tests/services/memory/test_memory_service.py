from __future__ import annotations

from deeptutor.services.memory.service import MemoryService
from deeptutor.services.session.sqlite_store import SQLiteSessionStore


def _make_service(tmp_path):
    """构建使用临时目录的长期记忆服务。

    输入：
        tmp_path: pytest 提供的临时目录。
    输出：
        返回 MemoryService 测试实例。
    """
    store = SQLiteSessionStore(tmp_path / "chat_history.db")
    return MemoryService(
        path_service=type(
            "PathServiceStub",
            (),
            {"get_memory_dir": lambda self: tmp_path / "memory"},
        )(),
        store=store,
    )


def test_memory_service_snapshot_is_empty_without_file(tmp_path) -> None:
    """验证没有文件时快照为空。

    输入：
        tmp_path: pytest 提供的临时目录。
    输出：
        无；通过断言验证空快照。
    """
    service = _make_service(tmp_path)
    snapshot = service.read_snapshot()

    assert snapshot.summary == ""
    assert snapshot.profile == ""
    assert snapshot.summary_updated_at is None
    assert snapshot.profile_updated_at is None


async def _no_change_stream(**_kwargs):
    """模拟模型判断长期记忆无需更新。

    输入：
        _kwargs: llm_stream 调用参数。
    输出：
        异步产出 NO_CHANGE。
    """
    yield "NO_CHANGE"


async def _rewrite_stream(**kwargs):
    """模拟模型按中文标题重写长期记忆。

    输入：
        kwargs: llm_stream 调用参数，其中 prompt 用于区分文件类型。
    输出：
        异步产出中文 Markdown 长期记忆。
    """
    prompt = str(kwargs.get("prompt", ""))
    if "用户画像" in prompt:
        yield "## 偏好\n- 用户偏好简洁回答。"
    else:
        yield "## 当前关注\n- 正在完善 DeepTutor 长期记忆。"


def test_memory_service_refresh_turn_writes_rewritten_document(monkeypatch, tmp_path) -> None:
    """验证单轮刷新会写入中文长期记忆。

    输入：
        monkeypatch: pytest monkeypatch fixture。
        tmp_path: pytest 提供的临时目录。
    输出：
        无；通过断言验证文件内容。
    """
    service = _make_service(tmp_path)
    monkeypatch.setattr("deeptutor.services.memory.service.llm_stream", _rewrite_stream)

    import asyncio

    result = asyncio.run(
        service.refresh_from_turn(
            user_message="Please remember that I like concise answers.",
            assistant_message="Sure, I'll keep answers concise.",
            session_id="s1",
            capability="chat",
            language="en",
        )
    )

    assert result.changed is True
    assert "简洁回答" in result.content
    assert "## 偏好" in service.read_profile()
    assert "## 当前关注" in service.read_summary()


def test_memory_service_refresh_turn_prompts_stay_chinese_with_english_language(
    monkeypatch,
    tmp_path,
) -> None:
    """验证传入英文语言偏好时长期记忆 prompt 仍要求中文记录。

    输入：
        monkeypatch: pytest monkeypatch fixture。
        tmp_path: pytest 提供的临时目录。
    输出：
        无；通过断言验证 prompt 语言约束。
    """
    service = _make_service(tmp_path)
    captured_prompts: list[str] = []

    async def capture_stream(**kwargs):
        """捕获 llm_stream prompt 并返回无更新。

        输入：
            kwargs: llm_stream 调用参数。
        输出：
            异步产出 NO_CHANGE。
        """
        captured_prompts.append(str(kwargs.get("prompt", "")))
        yield "NO_CHANGE"

    monkeypatch.setattr("deeptutor.services.memory.service.llm_stream", capture_stream)

    import asyncio

    result = asyncio.run(
        service.refresh_from_turn(
            user_message="Remember I use pytest often.",
            assistant_message="Got it.",
            session_id="s1",
            capability="chat",
            language="en",
        )
    )

    assert result.changed is False
    assert captured_prompts
    assert all("输出必须使用简体中文" in prompt for prompt in captured_prompts)
    assert all("不要使用英文标题" in prompt for prompt in captured_prompts)


def test_memory_service_refresh_turn_skips_when_model_returns_no_change(
    monkeypatch,
    tmp_path,
) -> None:
    """验证模型返回 NO_CHANGE 时不写入长期记忆文件。

    输入：
        monkeypatch: pytest monkeypatch fixture。
        tmp_path: pytest 提供的临时目录。
    输出：
        无；通过断言验证没有文件生成。
    """
    service = _make_service(tmp_path)
    monkeypatch.setattr("deeptutor.services.memory.service.llm_stream", _no_change_stream)

    import asyncio

    result = asyncio.run(
        service.refresh_from_turn(
            user_message="What is 2+2?",
            assistant_message="4",
            session_id="s1",
            capability="chat",
            language="en",
        )
    )

    assert result.changed is False
    assert result.content == ""
    assert not service._path("profile").exists()
    assert not service._path("summary").exists()
