# DeepTutor Agent 工作指南

## 交流规则

- 与用户交流时，除 `API`、`CLI`、`LLM`、`RAG`、`WebSocket`、`FastAPI`、`pytest`、类名、函数名、路径、命令等专业术语外，统一使用中文。
- 回答要直接说明结论、修改内容、验证结果和剩余风险；不要只给方案而不落地。
- 每次完成代码或文档修改后，最后必须整理“修改了哪些文件”，并写出具体路径。
- 不要在本地执行安装、启动、构建、测试、lint、迁移、Docker 等运行类指令；当前本地没有完整运行环境，用户会同步到服务器后再执行。
- 如果没有运行验证命令，要明确说明原因是“本地没有环境，按要求不执行运行类指令”，并给出已完成的静态检查或人工核对。

## 项目概览

DeepTutor 是一个 agent-native 智能学习 companion，核心是两层能力模型：

- Level 1：`Tool`，面向单次调用的小工具，例如 `rag`、`web_search`、`code_execution`、`reason`、`brainstorm`、`paper_search`、`geogebra_analysis`。
- Level 2：`Capability`，面向多步骤流程的能力，例如 `chat`、`deep_solve`、`deep_question`、`deep_research`、`math_animator`、`visualize`。

主要入口：

- `deeptutor_cli/main.py`：Typer `CLI` 入口。
- `deeptutor/api/main.py`、`deeptutor/api/run_server.py`：`FastAPI` 服务入口。
- `deeptutor/api/routers/unified_ws.py`：统一 `WebSocket` 端点。
- `deeptutor/runtime/orchestrator.py`：`ChatOrchestrator`，负责统一路由到默认聊天或指定 `Capability`。

## 当前项目结构

```text
D:\Project\DeepTutor
├─ deeptutor/                  Python 后端主包
│  ├─ core/                    StreamEvent、StreamBus、UnifiedContext、Tool/Capability 协议
│  ├─ runtime/                 ChatOrchestrator、RunMode、registry、bootstrap
│  ├─ capabilities/            chat、deep_solve、deep_question、deep_research、math_animator、visualize
│  ├─ agents/                  具体 agent 流程：chat、solve、question、research、notebook、co_writer 等
│  ├─ tools/                   rag、web_search、code_executor、reason、brainstorm、paper_search、vision/question 工具
│  ├─ services/                LLM、embedding、RAG、memory、session、prompt、storage、settings 等服务层
│  ├─ api/                     FastAPI 路由、统一 WebSocket、系统/知识库/会话/设置等接口
│  ├─ knowledge/               知识库创建、文档追加、命名、进度跟踪
│  ├─ tutorbot/                TutorBot 引擎与渠道集成
│  ├─ app/                     应用 facade
│  └─ config/、logging/、events/、utils/
├─ deeptutor_cli/              命令行入口与子命令
├─ web/                        主 Next.js 前端，默认开发端口 3782
├─ web_new/                    另一套 Next.js 前端，默认端口 3783
├─ tests/                      pytest 测试，按 api/core/services/agents/cli 等模块拆分
├─ requirements/               与 pyproject.toml optional-dependencies 对齐的依赖清单
├─ scripts/                    启动、安装检查、迁移、同步和测试辅助脚本
├─ assets/                     README 和文档使用的图片资源
├─ data/                       本地运行数据和用户数据，除非明确要求不要清理
├─ pyproject.toml              Python 依赖、pytest、Ruff、Black、MyPy、Bandit 配置
├─ .pre-commit-config.yaml     pre-commit 钩子配置
└─ README.md                   用户使用说明
```

注意：当前工作树中未看到 `deeptutor/plugins/` 目录。新增 plugin 或 playground 能力前，先确认当前 registry、capability 和 API 的实际约定，不要照搬旧结构假设。

## 安装与运行命令

以下命令仅作为服务器环境中的参考命令记录。Agent 不要在本地执行这些命令，除非用户明确解除限制；本地没有完整环境，需要由用户同步到服务器后运行。

### Python 环境

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e ".[server]"
```

开发时建议安装完整依赖：

```powershell
pip install -e ".[all]"
```

只使用命令行时：

```powershell
pip install -e ".[cli]"
```

首次运行前复制环境变量模板，并填写模型、embedding、搜索等密钥：

```powershell
Copy-Item .env.example .env
```

不要提交 `.env`、本地密钥、token、日志或运行数据。

### 后端服务

```powershell
python -m deeptutor.api.run_server
```

也可以使用 `CLI`：

```powershell
deeptutor serve --port 8001
```

### 前端服务

主前端：

```powershell
Set-Location web
npm install
npm run dev -- -p 3782
```

`web_new`：

```powershell
Set-Location web_new
npm install
npm run dev
```

### 一键启动本地 Web

```powershell
python scripts/start_web.py
```

该脚本会尝试同时启动后端和前端。

### CLI 常用命令

```powershell
deeptutor chat
deeptutor run chat "Explain Fourier transform"
deeptutor run deep_solve "Solve x^2 = 4" -t reason
deeptutor run deep_question "Linear algebra" --config num_questions=5
deeptutor kb list
deeptutor kb create my-kb --doc textbook.pdf
deeptutor memory show
deeptutor bot list
```

### Docker

```powershell
docker compose up -d
docker compose logs -f
docker compose down
```

开发 compose：

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## 测试与检查命令

以下测试和检查命令仅作为服务器验证参考。Agent 不要在本地执行 `pytest`、`ruff`、`mypy`、`bandit`、`pre-commit`、`npm run lint`、`npm run build`、Playwright audit 等运行类指令；完成修改后只说明建议在服务器执行哪些命令。

### Python 测试

运行全部测试：

```powershell
pytest
```

运行指定目录或文件：

```powershell
pytest tests/api
pytest tests/services/llm/test_client.py
pytest tests/runtime/test_orchestrator.py
```

`pytest` 配置在 `pyproject.toml` 的 `[tool.pytest.ini_options]` 中，默认测试目录是 `tests`，并启用 `--strict-markers`、`--strict-config`、`--tb=short`。

### Python 代码质量

```powershell
ruff check .
ruff check . --fix
ruff format .
mypy deeptutor deeptutor_cli
bandit -c pyproject.toml -r deeptutor
pre-commit run --all-files
```

说明：

- `pyproject.toml` 中 `line-length = 100`。
- `Ruff` 主要启用 `E`、`F`、`I`，并额外启用 `B006`。
- `Ruff format` 使用双引号、空格缩进、自动换行符。
- `Black` 配置仍存在，但当前 pre-commit 主要使用 `Ruff` 和 `ruff-format`。
- `MyPy` 处于渐进式类型检查配置，整体较宽松。

### 前端检查

主前端：

```powershell
Set-Location web
npm run lint
npm run test:node
npm run i18n:check
npm run build
```

UI audit：

```powershell
Set-Location web
npm run audit
```

`web_new`：

```powershell
Set-Location web_new
npm run lint
npm run build
```

只修改后端时不必强制跑前端构建；只修改前端时至少运行对应目录的 `npm run lint`，高风险 UI 改动再运行 `npm run build` 或 Playwright audit。

## 代码风格

### Python

- 使用 Python 3.11+ 语法，遵循已有模块分层和命名方式。
- 新增或修改函数签名时加类型标注。
- 优先使用 `Path`、结构化配置、已有 service/facade/registry，不要随意新增并行抽象。
- 异步流程保持 `async`/`await` 一致，不要在事件循环中阻塞式调用长任务。
- 修改 `Capability`、`Tool`、`StreamBus`、`UnifiedContext`、`ChatOrchestrator` 时，要同步考虑 CLI、API 和 SDK 三个入口。
- 修改 optional dependency 时，同步维护 `pyproject.toml` 和 `requirements/*.txt`。
- 新增 public module、class、function 时写 docstring；复杂逻辑可以加简短中文注释。

### 注释与方法输入输出说明

- 所有新增或修改的代码注释必须使用中文；专业术语、参数名、类型名、协议名、异常名可以保留英文。
- 新增或修改的方法、函数，应在 docstring 或方法上方中文注释中说明“输入”和“输出”。
- 如果函数没有返回值，也要明确写“输出：无”或“输出：通过 stream/event/store 产生副作用”。
- 不要写无意义注释，例如“给变量赋值”；注释应解释意图、约束、边界条件或输入输出。

推荐格式：

```python
def build_context(session_id: str, message: str) -> UnifiedContext:
    """构建单轮对话上下文。

    输入：
        session_id: 当前会话标识。
        message: 用户本轮输入。
    输出：
        返回可交给 ChatOrchestrator 使用的 UnifiedContext。
    """
```

### 前端

- 主前端位于 `web/`，使用 `Next.js`、`React`、`TypeScript`、`Tailwind CSS`。
- `web_new/` 是另一套前端，修改前确认用户目标指向哪个前端。
- 优先复用现有组件、hooks、context、lib 和 i18n 结构。
- UI 文案要兼顾 `web/locales` 和 i18n 校验；新增用户可见文本时注意多语言一致性。
- 图标优先使用 `lucide-react`。
- 不要修改 `node_modules/`、`.next/`、构建产物或 lock 之外的生成文件，除非任务明确要求。

## 注意事项

- 工作区可能已有用户修改。不要回滚、覆盖或清理自己没有创建的改动。
- 不要执行任何运行类指令，包括但不限于依赖安装、服务启动、测试、lint、构建、Docker、数据库迁移和脚本启动；这些命令只能作为建议列出，由用户同步到服务器后执行。
- 不要执行破坏性命令，例如 `git reset --hard`、强制删除目录、清空数据目录，除非用户明确要求。
- `data/`、`.env`、日志、知识库索引和用户运行数据默认视为本地状态，不要随意修改或删除。
- 修改安全、鉴权、密钥、沙箱执行、文件上传、RAG 索引、LLM provider、embedding 维度相关代码时，必须列出服务器上需要运行的针对性测试，但不要在本地执行。
- 修改 `deeptutor/tools/` 时，要检查工具名称、schema、prompting hints 和 tests 是否需要同步。
- 修改 `deeptutor/capabilities/` 或 `deeptutor/agents/` 时，要检查 `runtime/bootstrap`、registry、CLI、API router 和测试覆盖。
- 修改 `deeptutor/api/routers/unified_ws.py` 或 stream event 协议时，要确认前端事件消费和 `tests/api/test_unified_ws_turn_runtime.py`。
- 修改 prompt、i18n 或中英文并行资源时，优先运行对应同步和 parity 检查。
- 每次提交前优先建议用户在服务器运行与改动范围匹配的最小测试集，再视风险建议运行 `pytest` 或 `pre-commit run --all-files`；不要在本地执行。

## 结果汇报格式

完成修改后的回复必须包含：

- 修改摘要：说明做了什么。
- 验证结果：说明未运行命令的原因是“本地没有环境，按要求不执行运行类指令”，并列出建议用户在服务器执行的命令。
- 修改文件：列出具体路径，例如 `D:\Project\DeepTutor\AGENTS.md`。

示例：

```text
已更新根目录 Agent 工作指南，补充运行命令、测试命令、中文沟通与注释规范。

验证：未运行命令，原因是本地没有环境，按要求不执行运行类指令。建议同步到服务器后按需运行 Markdown 或文档检查。

修改文件：
- D:\Project\DeepTutor\AGENTS.md
```
