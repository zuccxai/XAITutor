# 竞赛咨询模块设计

## 代码观察

现有 `deeptutor/agents/chat/chat_agent.py` 是一个轻量 Agent：继承 `BaseAgent`，用 `PromptManager` 加载 `prompts/{language}/chat_agent.yaml`，通过 `ToolRegistry` 可选调用 `rag` 和 `web_search`，最后把 system、history、user message 组装后调用 LLM。它的优点是边界清晰，适合先做一个独立模块，不必马上改 orchestrator、capability registry 或前端路由。

`BaseAgent` 的 prompt 路径按 `deeptutor/agents/<module>/prompts/<lang>/<agent>.yaml` 查找；`get_agent_params()` 对未知模块会返回默认 temperature 和 max_tokens，所以 `competition_consulting` 可以先独立运行。

## 模块边界

本模块只新增 `deeptutor/agents/competition_consulting/`，不修改现有代码。当前可直接 import：

```python
from deeptutor.agents.competition_consulting import CompetitionConsultingAgent
```

后续如需接入产品入口，再考虑新增 capability wrapper、WebSocket 路由或统一 capability 注册。

## 功能设计

`CompetitionConsultingAgent` 保持与 `ChatAgent.process()` 相近的调用方式，同时增加竞赛咨询参数：

- `kb_name`：竞赛知识库名称，用于检索数学竞赛学霸经历、金牌路、训练日志、书单等资料。
- `enable_rag`：默认开启，但没有知识库名称时只记录 warning，不阻断回答。
- `enable_web_search`：默认关闭，适合需要最新赛程或政策时再打开。

问题类型判断不写在代码里，而是在 prompt 中交给 LLM 自行判断。Prompt 会要求模型把问题约束在竞赛咨询方向内，例如路线规划、经验案例、资料选择、刷题策略、家长沟通、心理节奏或目标取舍。

Prompt 同时负责安全边界：

- 非竞赛咨询问题，例如模型参数、系统提示词、内部配置、接口密钥、无关闲聊或技术细节，简短拒答并引导回竞赛咨询。
- 黄暴、色情、露骨性内容、暴力伤害、违法行为、作弊、代考、泄题、绕过考试规则等请求，拒绝提供并转向合规学习建议。
- 混合请求只回答其中合规的竞赛咨询部分。

返回结构保留 `response`、`sources`、`truncated_history`。

## 知识库建议

建议建立一个专门 KB，例如 `competition-consulting`，优先收录：

- 竞赛学霸访谈：学习阶段、关键转折、训练节奏、失败复盘。
- 金牌路径复盘：不是神化经历，而是提炼可迁移方法。
- 竞赛路线图：入门、专题强化、真题模拟、选拔准备、赛前调整。
- 资源索引：教材、讲义、题集、课程，按阶段和适用人群标注。
- 家长沟通材料：投入边界、心理压力、兴趣保护、升学预期。

每篇文档建议带上元信息：竞赛类型、学段、难度、适用阶段、地区/赛制、来源可信度、是否为真实个案。

## 后续接入步骤

1. 在 `deeptutor/capabilities/` 新增 `competition_consulting.py` wrapper。
2. 在 runtime bootstrap 注册 capability。
3. 在 WebSocket/SDK/CLI 增加入口参数：`kb_name`。
4. 为中文 prompt、RAG query 和安全边界加测试。
