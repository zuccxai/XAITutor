# XAITutor 反向 SSH 隧道连接学校内网模型方案

本文档说明如何让部署在阿里云 ECS 上的 XAITutor 访问学校内网模型服务。

适用场景：

- XAITutor 部署在阿里云 ECS。
- LLM 和 Embedding 服务部署在学校内网服务器。
- 阿里云 ECS 无法直接访问学校内网 IP。
- 学校内网服务器可以主动 SSH 到阿里云 ECS。

当前示例：

```text
学校 LLM 服务：       http://10.66.50.102:8000/v1
学校 Embedding 服务： http://10.66.50.103:8002/v1/embeddings

ECS 本地隧道端口：
LLM       -> 127.0.0.1:18000
Embedding -> 127.0.0.1:18002
```

## 一、方案原理

学校内网服务器主动连到阿里云 ECS，建立反向端口转发：

```text
ECS 127.0.0.1:18000 -> 学校 10.66.50.102:8000
ECS 127.0.0.1:18002 -> 学校 10.66.50.103:8002
```

XAITutor 容器使用 `network_mode: host` 后，可以直接访问 ECS 宿主机的：

```text
http://127.0.0.1:18000/v1
http://127.0.0.1:18002/v1
```

注意：

- 不要把隧道绑定到 `0.0.0.0`。
- 不要在阿里云安全组开放 `18000`、`18002`。
- 隧道端口只监听 `127.0.0.1` 时，不会暴露到公网。

## 二、风险说明

使用反向 SSH 隧道前，应确认学校网络管理规定允许。

主要风险：

- 合规风险：学校可能不允许将内网模型服务通过隧道提供给外部服务器。
- 资源风险：XAITutor 请求会消耗学校模型服务器的 GPU、CPU、显存和带宽。
- 稳定性风险：SSH 连接断开后，ECS 无法继续访问模型服务。
- 安全风险：如果误用 `-R 0.0.0.0:端口`，可能把模型端口暴露到公网。

安全建议：

- 只绑定 `127.0.0.1`。
- 阿里云安全组不要开放 `18000`、`18002`。
- 使用 SSH key，不建议长期使用密码连接。
- 生产长期运行建议使用 `autossh` 或 `systemd` 托管。

## 三、在学校内网服务器建立隧道

在能访问下面两个内网模型地址的学校服务器上执行：

```bash
ssh -N \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -R 127.0.0.1:18000:10.66.50.102:8000 \
  -R 127.0.0.1:18002:10.66.50.103:8002 \
  root@阿里云ECS公网IP
```

含义：

- `-N`：只建隧道，不执行远程命令。
- `-R 127.0.0.1:18000:10.66.50.102:8000`：ECS 本机 `18000` 转发到学校 LLM 服务。
- `-R 127.0.0.1:18002:10.66.50.103:8002`：ECS 本机 `18002` 转发到学校 Embedding 服务。
- `ExitOnForwardFailure=yes`：任意端口转发失败时立即退出。

不要这样写：

```bash
-R 0.0.0.0:18000:10.66.50.102:8000
```

## 四、如何取消反向隧道

如果隧道在前台运行，直接：

```bash
Ctrl + C
```

如果在后台运行，学校服务器上查进程：

```bash
ps aux | grep 'ssh -N'
```

杀掉对应进程：

```bash
kill <PID>
```

如果使用 `systemd` 托管：

```bash
sudo systemctl stop xaitutor-tunnel
sudo systemctl disable xaitutor-tunnel
```

取消后，ECS 上的 `127.0.0.1:18000` 和 `127.0.0.1:18002` 将不可用。

## 五、在阿里云 ECS 上验证隧道

在 ECS 宿主机执行：

```bash
ss -lntp | grep -E '18000|18002'
```

安全状态应类似：

```text
LISTEN 127.0.0.1:18000
LISTEN 127.0.0.1:18002
```

不要出现：

```text
LISTEN 0.0.0.0:18000
LISTEN 0.0.0.0:18002
```

测试 LLM：

```bash
curl http://127.0.0.1:18000/v1/models
```

测试 LLM chat：

```bash
curl http://127.0.0.1:18000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-no-key-required" \
  -d '{"model":"/data1/qwen3.5","messages":[{"role":"user","content":"你好"}],"max_tokens":32}'
```

测试 Embedding models：

```bash
curl http://127.0.0.1:18002/v1/models
```

测试 Embedding：

```bash
curl http://127.0.0.1:18002/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-no-key-required" \
  -d '{"model":"/data0/models/Qwen3-Embedding-8B","input":["hello"]}'
```

如果 ECS 宿主机测试失败，应先检查：

- 学校内网机器能否访问 `10.66.50.102:8000`。
- 学校内网机器能否访问 `10.66.50.103:8002`。
- SSH 连接是否断开。
- ECS 的 `sshd` 是否允许反向转发。

## 六、XAITutor docker-compose.yml 配置

因为 SSH 隧道监听在 ECS 宿主机 `127.0.0.1`，容器默认网络无法访问这个地址。

推荐让 XAITutor 容器使用 host 网络：

```yaml
name: xaitutor

services:
  xaitutor:
    image: xaitutor:prod-YYYYMMDD
    container_name: xaitutor
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env
    volumes:
      - ./data/user:/app/data/user
      - ./data/knowledge_bases:/app/data/knowledge_bases
      - ./data/memory:/app/data/memory
      - ./data/tutorbot:/app/data/tutorbot
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${BACKEND_PORT:-8001}/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

使用 `network_mode: host` 后，不要再配置：

```yaml
ports:
extra_hosts:
networks:
```

说明：

- 容器会直接使用 ECS 宿主机网络。
- XAITutor 仍会监听 `8001` 和 `3783`。
- Nginx 仍然可以反代到 `127.0.0.1:8001` 和 `127.0.0.1:3783`。
- 模型隧道端口 `18000`、`18002` 不会自动暴露到公网。

验证容器是否为 host 网络：

```bash
docker inspect xaitutor --format '{{.HostConfig.NetworkMode}}'
```

应输出：

```text
host
```

## 七、XAITutor .env 配置

生产服务器 `/opt/xaitutor/.env` 推荐：

```dotenv
BACKEND_PORT=8001
FRONTEND_PORT=3783

LLM_BINDING=openai
LLM_MODEL=/data1/qwen3.5
LLM_API_KEY=sk-no-key-required
LLM_HOST=http://127.0.0.1:18000/v1
LLM_API_VERSION=

EMBEDDING_BINDING=vllm
EMBEDDING_MODEL=/data0/models/Qwen3-Embedding-8B
EMBEDDING_API_KEY=sk-no-key-required
EMBEDDING_HOST=http://127.0.0.1:18002/v1
EMBEDDING_DIMENSION=4096
EMBEDDING_API_VERSION=
EMBEDDING_SEND_DIMENSIONS=false

NEXT_PUBLIC_API_BASE_EXTERNAL=http://阿里云ECS公网IP
DISABLE_SSL_VERIFY=false
```

注意：

- `LLM_HOST` 使用隧道地址：`http://127.0.0.1:18000/v1`
- `EMBEDDING_HOST` 使用隧道地址：`http://127.0.0.1:18002/v1`
- `EMBEDDING_HOST` 通常不要写到 `/v1/embeddings`，因为程序会自行请求 embeddings endpoint。
- `EMBEDDING_DIMENSION` 必须与实际 embedding 模型输出维度一致。
- `EMBEDDING_SEND_DIMENSIONS=false` 可避免部分本地兼容服务不支持 `dimensions` 参数。

修改 `.env` 后重启：

```bash
cd /opt/xaitutor
docker compose up -d --force-recreate
```

## 八、注意 model_catalog.json 覆盖问题

XAITutor 可能从以下文件读取模型配置：

```text
data/user/settings/main.yaml
data/user/settings/agents.yaml
data/user/settings/model_catalog.json
```

如果 `.env` 已经改对，但日志仍然显示连接旧地址，例如：

```text
10.66.50.103:8002
```

通常是 `data/user/settings/model_catalog.json` 覆盖了 `.env`。

排查命令：

```bash
cd /opt/xaitutor
grep -R "10.66.50.103\|10.66.50.102\|18000\|18002\|base_url\|Qwen3-Embedding" data/user/settings
```

处理前先备份：

```bash
cp -r data/user/settings data/user/settings.bak.$(date +%Y%m%d%H%M%S)
```

然后在页面的系统设置中修改模型配置，或直接修改：

```text
data/user/settings/model_catalog.json
```

应把 LLM base URL 改为：

```text
http://127.0.0.1:18000/v1
```

应把 Embedding base URL 改为：

```text
http://127.0.0.1:18002/v1
```

修改后重启：

```bash
docker compose up -d --force-recreate
```

## 九、容器内验证

进入容器：

```bash
docker exec -it xaitutor bash
```

测试 LLM：

```bash
curl http://127.0.0.1:18000/v1/models
```

测试 Embedding：

```bash
curl http://127.0.0.1:18002/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-no-key-required" \
  -d '{"model":"/data0/models/Qwen3-Embedding-8B","input":["hello"]}'
```

如果 ECS 宿主机测试成功，但容器内测试失败：

- 检查 `docker inspect xaitutor --format '{{.HostConfig.NetworkMode}}'` 是否为 `host`。
- 检查容器是否已用 `docker compose up -d --force-recreate` 重建。

## 十、Nginx 与公网端口

使用 Nginx 反代时，公网建议只开放：

```text
80
22
```

有 HTTPS 后开放：

```text
443
```

不需要开放：

```text
18000
18002
3783
8001
```

Nginx 可以反代：

```text
127.0.0.1:3783 -> XAITutor 前端
127.0.0.1:8001 -> XAITutor 后端
```

反向隧道端口 `18000`、`18002` 只给 ECS 本机和 host 网络容器使用。

## 十一、常见问题

### 1. ECS 上 `curl 127.0.0.1:18000/v1/models` 正常，容器里失败

原因通常是容器不是 host 网络。

检查：

```bash
docker inspect xaitutor --format '{{.HostConfig.NetworkMode}}'
```

应为：

```text
host
```

### 2. Embedding 一直 ConnectTimeout

排查顺序：

```bash
curl http://127.0.0.1:18002/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-no-key-required" \
  -d '{"model":"/data0/models/Qwen3-Embedding-8B","input":["hello"]}'
```

如果宿主机正常，继续查：

```bash
docker exec -it xaitutor bash
echo $EMBEDDING_HOST
grep -R "10.66.50.103\|18002\|base_url" /app/data/user/settings 2>/dev/null
```

重点检查 `model_catalog.json` 是否覆盖 `.env`。

### 3. LLM `/v1/models` 正常，但聊天超时

继续测试 chat endpoint：

```bash
curl http://127.0.0.1:18000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-no-key-required" \
  -d '{"model":"/data1/qwen3.5","messages":[{"role":"user","content":"你好"}],"max_tokens":32}'
```

如果这个请求慢或超时，说明模型生成端慢、模型服务负载高，或模型服务本身不兼容 OpenAI chat completions。

### 4. 如何确认模型端口没有暴露公网

ECS 上执行：

```bash
ss -lntp | grep -E '18000|18002'
```

安全结果：

```text
127.0.0.1:18000
127.0.0.1:18002
```

不安全结果：

```text
0.0.0.0:18000
0.0.0.0:18002
```

阿里云安全组也不要添加 `18000`、`18002` 入方向规则。
