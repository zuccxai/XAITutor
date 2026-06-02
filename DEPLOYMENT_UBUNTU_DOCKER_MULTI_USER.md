# DeepTutor 多用户版 Ubuntu Docker 部署方案

本文面向公网 Ubuntu 服务器部署 DeepTutor 当前多用户版本。方案以“单台服务器、单个应用容器、Nginx 反向代理、HTTPS、多用户登录”为推荐生产形态。

## 一、部署结论

- 推荐部署目录：`/opt/deeptutor`
- 推荐容器名：`deeptutor`
- 当前 `Dockerfile` 构建的是 `web_new` 前端，生产前端端口建议显式使用 `3783`
- 后端端口：`8001`
- 公网只开放 `80/443/22`，不要直接开放 `8001/3783`
- 多用户必须启用：`AUTH_ENABLED=true`
- 多用户生产部署不要启用 `POCKETBASE_URL`，当前 PocketBase 模式仍按单用户路径设计
- 必须持久化 `multi-user/`，否则账号、授权、审计和普通用户工作区会随容器重建丢失

## 二、目录与数据规划

服务器目录建议如下：

```text
/opt/deeptutor
├─ docker-compose.yml
├─ .env
├─ data/
│  ├─ user/
│  ├─ knowledge_bases/
│  ├─ memory/
│  └─ tutorbot/
└─ multi-user/
   ├─ _system/
   │  ├─ auth/
   │  │  ├─ users.json
   │  │  └─ auth_secret
   │  ├─ grants/
   │  ├─ audit/
   │  └─ indexes/
   └─ <user_id>/
      ├─ knowledge_bases/
      ├─ memory/
      └─ user/
```

持久化重点：

- `data/user`：管理员默认工作区、设置、日志、附件等
- `data/knowledge_bases`：管理员或旧版全局知识库数据
- `data/memory`：旧版或管理员记忆数据
- `data/tutorbot`：TutorBot 数据
- `multi-user`：多用户账号、JWT secret、授权、审计、每个普通用户的隔离工作区

## 三、推荐 docker-compose.yml

推荐先使用本项目源码构建出的生产镜像，镜像名示例为 `deeptutor:multi-user-YYYYMMDD`。生产服务器上的 `/opt/deeptutor/docker-compose.yml` 建议如下：

```yaml
name: deeptutor

services:
  deeptutor:
    image: deeptutor:multi-user-YYYYMMDD
    container_name: deeptutor
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "127.0.0.1:${BACKEND_PORT:-8001}:${BACKEND_PORT:-8001}"
      - "127.0.0.1:${FRONTEND_PORT:-3783}:${FRONTEND_PORT:-3783}"
    volumes:
      - ./data/user:/app/data/user
      - ./data/knowledge_bases:/app/data/knowledge_bases
      - ./data/memory:/app/data/memory
      - ./data/tutorbot:/app/data/tutorbot
      - ./multi-user:/app/multi-user
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${BACKEND_PORT:-8001}/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

说明：

- `127.0.0.1:8001` 和 `127.0.0.1:3783` 只允许服务器本机访问，由 Nginx 对外提供 HTTPS。
- 如果暂时不用 Nginx、直接用服务器 IP 访问，可改成 `"${BACKEND_PORT:-8001}:${BACKEND_PORT:-8001}"` 和 `"${FRONTEND_PORT:-3783}:${FRONTEND_PORT:-3783}"`，但不建议公网长期这样运行。
- 如果需要让容器访问宿主机上的反向 SSH 隧道或本地模型服务，可改用 `network_mode: host`，同时删除 `ports` 配置。

## 四、生产 .env 模板

生产服务器上的 `/opt/deeptutor/.env` 建议从下面模板开始维护，不要直接上传开发环境 `.env`。

```dotenv
# 端口
BACKEND_PORT=8001
FRONTEND_PORT=3783

# LLM
LLM_BINDING=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=替换为生产key
LLM_HOST=https://api.openai.com/v1
LLM_API_VERSION=
LLM_REASONING_EFFORT=

# Embedding
EMBEDDING_BINDING=openai
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_API_KEY=替换为生产key
EMBEDDING_HOST=https://api.openai.com/v1/embeddings
EMBEDDING_API_VERSION=
EMBEDDING_DIMENSION=
EMBEDDING_SEND_DIMENSIONS=

# 搜索，可选
SEARCH_PROVIDER=
SEARCH_API_KEY=
SEARCH_BASE_URL=
SEARCH_PROXY=

# 公网访问地址。使用同域 Nginx 反代时填站点根地址，不要带 /api。
NEXT_PUBLIC_API_BASE_EXTERNAL=https://deeptutor.example.com
NEXT_PUBLIC_API_BASE=

# 启用登录和多用户
AUTH_ENABLED=true
NEXT_PUBLIC_AUTH_ENABLED=true
AUTH_SECRET=替换为64位以上随机字符串
AUTH_TOKEN_EXPIRE_HOURS=24
AUTH_COOKIE_SECURE=true

# 当前多用户生产模式必须留空
AUTH_USERNAME=
AUTH_PASSWORD_HASH=
POCKETBASE_URL=
POCKETBASE_ADMIN_EMAIL=
POCKETBASE_ADMIN_PASSWORD=
POCKETBASE_EXTERNAL_URL=

# CORS。若前后端同域，可留空；若前端和后端不同域，填前端 Origin。
CORS_ORIGIN=
CORS_ORIGINS=

# 安全
DISABLE_SSL_VERIFY=false
CHAT_ATTACHMENT_DIR=
```

生成 `AUTH_SECRET` 的参考命令：

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

如果使用不同域名，例如前端 `https://learn.example.com`、后端 `https://api.example.com`：

```dotenv
NEXT_PUBLIC_API_BASE_EXTERNAL=https://api.example.com
CORS_ORIGINS=https://learn.example.com
AUTH_COOKIE_SECURE=true
```

## 五、Nginx 反向代理

推荐把前端和后端放在同一个域名下：

- `https://deeptutor.example.com/` 转发到前端 `127.0.0.1:3783`
- `https://deeptutor.example.com/api/` 转发到后端 `127.0.0.1:8001/api/`
- `https://deeptutor.example.com/api/v1/ws/...` 等 WebSocket 路径同样走后端，并保留 Upgrade 头

Nginx 站点配置示例：

```nginx
server {
    listen 80;
    server_name deeptutor.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name deeptutor.example.com;

    ssl_certificate /etc/letsencrypt/live/deeptutor.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deeptutor.example.com/privkey.pem;

    client_max_body_size 200m;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3783;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

此模式下 `.env` 中建议：

```dotenv
NEXT_PUBLIC_API_BASE_EXTERNAL=https://deeptutor.example.com
AUTH_COOKIE_SECURE=true
CORS_ORIGINS=
```

## 六、首次部署流程

### 1. 在构建机器生成镜像

如果在服务器上直接构建：

```bash
cd /path/to/DeepTutor
docker build -t deeptutor:multi-user-YYYYMMDD .
```

如果在开发机或构建机打包后上传：

```bash
docker build -t deeptutor:multi-user-YYYYMMDD .
docker save deeptutor:multi-user-YYYYMMDD -o deeptutor-multi-user-YYYYMMDD.tar
scp deeptutor-multi-user-YYYYMMDD.tar user@server:/opt/deeptutor/
```

### 2. 在 Ubuntu 服务器准备目录

```bash
sudo mkdir -p /opt/deeptutor
sudo chown -R $USER:$USER /opt/deeptutor
cd /opt/deeptutor
mkdir -p data/user data/knowledge_bases data/memory data/tutorbot multi-user
```

### 3. 导入镜像

```bash
docker load -i deeptutor-multi-user-YYYYMMDD.tar
```

### 4. 写入配置文件

在 `/opt/deeptutor` 下创建：

- `docker-compose.yml`
- `.env`

确认 `.env` 中至少已经设置：

```dotenv
BACKEND_PORT=8001
FRONTEND_PORT=3783
NEXT_PUBLIC_API_BASE_EXTERNAL=https://deeptutor.example.com
AUTH_ENABLED=true
NEXT_PUBLIC_AUTH_ENABLED=true
AUTH_SECRET=生产随机密钥
AUTH_COOKIE_SECURE=true
POCKETBASE_URL=
```

### 5. 启动服务

```bash
cd /opt/deeptutor
docker compose up -d
```

### 6. 初始化管理员

浏览器访问：

```text
https://deeptutor.example.com/register
```

第一个注册用户会自动成为管理员。管理员创建后，公开注册入口会关闭；后续用户由管理员在：

```text
https://deeptutor.example.com/admin/users
```

中创建和管理。

## 七、上线验证清单

服务器侧建议检查：

```bash
docker compose ps
docker compose logs -f
curl http://127.0.0.1:8001/
curl http://127.0.0.1:3783/
```

浏览器侧建议检查：

- 能打开 `https://deeptutor.example.com`
- `/register` 可创建首个管理员
- 登录后 `/api/v1/auth/status` 返回已认证
- 管理员可打开 `/admin/users`
- 可创建普通用户并用普通用户登录
- 普通用户只能看到自己被授权的模型、技能、知识库
- 聊天、知识库上传、会话历史、附件预览可正常使用
- 重启容器后账号、授权、会话和知识库仍存在

## 八、备份与恢复

建议每日备份：

```bash
cd /opt/deeptutor
tar czf deeptutor-backup-$(date +%Y%m%d%H%M%S).tar.gz data multi-user .env docker-compose.yml
```

恢复时：

```bash
cd /opt/deeptutor
docker compose down
tar xzf deeptutor-backup-YYYYMMDDHHMMSS.tar.gz
docker compose up -d
```

重要说明：

- `.env` 中包含密钥，备份包需要加密保存。
- `multi-user/_system/auth/users.json` 是用户账号库。
- `multi-user/_system/auth/auth_secret` 或 `.env` 中的 `AUTH_SECRET` 关系到登录 token 校验，不要在恢复时随意替换。

## 九、升级与回滚

升级流程：

```bash
cd /opt/deeptutor
docker load -i deeptutor-multi-user-NEW.tar
```

修改 `docker-compose.yml`：

```yaml
image: deeptutor:multi-user-NEW
```

重新创建容器：

```bash
docker compose up -d
docker compose ps
docker compose logs -f
```

回滚流程：

```yaml
image: deeptutor:multi-user-OLD
```

然后执行：

```bash
docker compose up -d
```

回滚时不要删除：

```text
/opt/deeptutor/data
/opt/deeptutor/multi-user
```

## 十、本地模型或反向 SSH 隧道场景

如果 LLM 或 Embedding 服务只监听在 Ubuntu 宿主机 `127.0.0.1`，普通 bridge 网络容器无法直接访问宿主机回环地址。此时推荐把 compose 改成 host 网络：

```yaml
name: deeptutor

services:
  deeptutor:
    image: deeptutor:multi-user-YYYYMMDD
    container_name: deeptutor
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env
    volumes:
      - ./data/user:/app/data/user
      - ./data/knowledge_bases:/app/data/knowledge_bases
      - ./data/memory:/app/data/memory
      - ./data/tutorbot:/app/data/tutorbot
      - ./multi-user:/app/multi-user
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${BACKEND_PORT:-8001}/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

host 网络模式下：

- 删除 `ports`、`networks`、`extra_hosts`
- Nginx 仍然反代 `127.0.0.1:3783` 和 `127.0.0.1:8001`
- 模型隧道端口如 `127.0.0.1:18000`、`127.0.0.1:18002` 不需要开放到公网

`.env` 示例：

```dotenv
LLM_BINDING=openai
LLM_MODEL=本地模型名
LLM_API_KEY=sk-no-key-required
LLM_HOST=http://127.0.0.1:18000/v1

EMBEDDING_BINDING=vllm
EMBEDDING_MODEL=本地embedding模型名
EMBEDDING_API_KEY=sk-no-key-required
EMBEDDING_HOST=http://127.0.0.1:18002/v1/embeddings
EMBEDDING_SEND_DIMENSIONS=false
```

## 十一、安全注意事项

- 生产必须设置 `AUTH_ENABLED=true`
- HTTPS 下设置 `AUTH_COOKIE_SECURE=true`
- `AUTH_SECRET` 必须稳定保存，不要每次发版变更
- 不要设置 `POCKETBASE_URL` 作为多用户生产后端
- 不要把 `.env`、`multi-user/_system/auth/users.json`、`auth_secret` 提交到代码仓库
- 不要公开暴露模型隧道端口、Embedding 端口、`8001`、`3783`
- 单容器单后端 worker 是当前 JSON/SQLite 多用户路径最稳妥的部署形态；不要直接水平扩多个后端实例共享同一目录

## 十二、服务器建议执行的最小验证命令

部署或升级后建议在服务器执行：

```bash
cd /opt/deeptutor
docker compose ps
docker compose logs --tail=200 deeptutor
curl http://127.0.0.1:8001/
curl http://127.0.0.1:3783/
```

如果修改了认证、多用户、知识库或 WebSocket 相关代码，建议在服务器源码环境额外执行：

```bash
pytest tests/api/test_unified_ws_turn_runtime.py
pytest tests/api
pytest tests/services
```
