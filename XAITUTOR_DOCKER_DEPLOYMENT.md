# XAITutor Docker 生产部署最终说明

本文档用于将开发 Ubuntu 服务器上已经个性化开发完成的 XAITutor 部署到生产 Ubuntu 服务器。

当前约定：

- 后端端口：`8001`
- 前端目录：`web_new`
- 前端端口：`3783`
- Docker 镜像名：`xaitutor`
- Docker 容器名：`xaitutor`
- 生产持久化目录：
  - `./data/user`
  - `./data/knowledge_bases`
  - `./data/memory`
  - `./data/tutorbot`

说明：

- 生产环境不建议直接使用上游 `ghcr.io/hkuds/deeptutor` 镜像，因为它不包含本项目的个性化改动和 XAITutor 外显名称。
- 生产环境推荐使用“开发服务器构建镜像，生产服务器导入镜像”的方式。
- `.env` 不建议从开发环境直接上传到生产环境，应在生产服务器单独维护生产配置。

## 一、开发 Ubuntu 服务器操作

开发服务器负责确认代码、构建镜像、导出镜像包，并准备生产部署需要的配置模板。

### 1. 进入项目目录

```bash
cd /path/to/XAITutor
```

如果当前目录仍叫 `DeepTutor` 也可以，目录名不会影响容器运行；生产部署建议目录使用 `/opt/xaitutor`。

### 2. 确认关键配置

确认 `docker-compose.yml` 中生产服务应包含以下关键信息：

```yaml
name: xaitutor

services:
  xaitutor:
    image: xaitutor:prod
    container_name: xaitutor
    ports:
      - "${BACKEND_PORT:-8001}:${BACKEND_PORT:-8001}"
      - "${FRONTEND_PORT:-3783}:${FRONTEND_PORT:-3783}"
    env_file:
      - .env
    volumes:
      - ./data/user:/app/data/user
      - ./data/knowledge_bases:/app/data/knowledge_bases
      - ./data/memory:/app/data/memory
      - ./data/tutorbot:/app/data/tutorbot
```

确认 `Dockerfile` 已经构建 `web_new`：

```dockerfile
COPY web_new/package.json web_new/package-lock.json* ./
COPY web_new/ ./
```

确认 `web_new/next.config.js` 中有：

```js
output: "standalone"
```

### 3. 构建生产镜像

建议每次发布都使用日期或版本号打 tag：

```bash
docker compose build
docker tag xaitutor:prod xaitutor:prod-YYYYMMDD
```

示例：

```bash
docker tag xaitutor:prod xaitutor:prod-20260510
```

### 4. 导出镜像 tar 包

```bash
docker save xaitutor:prod-YYYYMMDD -o xaitutor-prod-YYYYMMDD.tar
```

示例：

```bash
docker save xaitutor:prod-20260510 -o xaitutor-prod-20260510.tar
```

### 5. 准备上传文件

首次部署至少需要上传：

```text
xaitutor-prod-YYYYMMDD.tar
docker-compose.prod.yml
.env.example 或 .env.production.example
```

其中：

- `xaitutor-prod-YYYYMMDD.tar` 是镜像包，必须上传。
- `docker-compose.prod.yml` 是生产运行编排文件，建议使用下文提供的生产版内容。
- `.env.example` 或 `.env.production.example` 只作为模板，不包含真实密钥。

不建议上传开发环境 `.env`。

如果生产环境需要继承开发环境已有数据，还需要上传这些目录：

```text
data/user
data/knowledge_bases
data/memory
data/tutorbot
```

如果生产环境是全新环境，不上传 `data` 内容，只在生产服务器创建空目录。

### 6. 上传到生产服务器

```bash
scp xaitutor-prod-YYYYMMDD.tar user@生产服务器IP:/opt/xaitutor/
scp docker-compose.prod.yml user@生产服务器IP:/opt/xaitutor/docker-compose.yml
scp .env.example user@生产服务器IP:/opt/xaitutor/.env.example
```

如果需要迁移数据，可以使用：

```bash
rsync -av data/user/ user@生产服务器IP:/opt/xaitutor/data/user/
rsync -av data/knowledge_bases/ user@生产服务器IP:/opt/xaitutor/data/knowledge_bases/
rsync -av data/memory/ user@生产服务器IP:/opt/xaitutor/data/memory/
rsync -av data/tutorbot/ user@生产服务器IP:/opt/xaitutor/data/tutorbot/
```

## 二、生产 Ubuntu 服务器首次部署

生产服务器负责安装 Docker、导入镜像、维护生产 `.env`、创建持久化目录并启动服务。

### 1. 安装 Docker

如果生产服务器尚未安装 Docker，执行：

```bash
sudo apt update
sudo apt install -y ca-certificates curl git

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

可选：让当前用户免 `sudo` 使用 Docker：

```bash
sudo usermod -aG docker $USER
```

执行后需要重新登录服务器。

### 2. 创建部署目录

```bash
sudo mkdir -p /opt/xaitutor
sudo chown -R $USER:$USER /opt/xaitutor
cd /opt/xaitutor
```

### 3. 创建持久化目录

```bash
mkdir -p data/user data/knowledge_bases data/memory data/tutorbot
```

这些目录不要随意删除，容器重启、升级、回滚都会继续复用它们。

### 4. 导入镜像

```bash
docker load -i xaitutor-prod-YYYYMMDD.tar
```

确认镜像已存在：

```bash
docker images | grep xaitutor
```

### 5. 准备生产 docker-compose.yml

生产服务器建议使用“无 build”的 compose 文件，避免生产服务器依赖源码和 Dockerfile。

`/opt/xaitutor/docker-compose.yml` 内容建议如下：

```yaml
name: xaitutor

services:
  xaitutor:
    image: xaitutor:prod-YYYYMMDD
    container_name: xaitutor
    restart: unless-stopped
    ports:
      - "${BACKEND_PORT:-8001}:${BACKEND_PORT:-8001}"
      - "${FRONTEND_PORT:-3783}:${FRONTEND_PORT:-3783}"
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
    networks:
      - xaitutor-network

networks:
  xaitutor-network:
    driver: bridge
```

把 `xaitutor:prod-YYYYMMDD` 改成实际导入的镜像 tag。

示例：

```yaml
image: xaitutor:prod-20260510
```

### 6. 准备生产 .env

生产服务器必须有 `/opt/xaitutor/.env`。

不建议直接上传开发环境 `.env`，原因：

- 开发环境 `.env` 可能包含开发 key。
- 开发环境模型地址可能是内网或本机地址。
- 生产环境的公网后端地址通常不同。

推荐在生产服务器上创建：

```bash
cp .env.example .env
nano .env
```

生产 `.env` 至少包含：

```dotenv
BACKEND_PORT=8001
FRONTEND_PORT=3783

LLM_BINDING=openai
LLM_MODEL=生产模型名称
LLM_API_KEY=生产模型key
LLM_HOST=https://api.openai.com/v1
LLM_API_VERSION=

EMBEDDING_BINDING=openai
EMBEDDING_MODEL=生产embedding模型
EMBEDDING_API_KEY=生产embedding key
EMBEDDING_HOST=https://api.openai.com/v1
EMBEDDING_DIMENSION=3072
EMBEDDING_API_VERSION=
EMBEDDING_SEND_DIMENSIONS=

SEARCH_PROVIDER=
SEARCH_API_KEY=
SEARCH_BASE_URL=

NEXT_PUBLIC_API_BASE_EXTERNAL=http://生产服务器公网IP:8001
NEXT_PUBLIC_API_BASE=

DISABLE_SSL_VERIFY=false
CHAT_ATTACHMENT_DIR=
```

如果生产环境使用域名和 HTTPS：

```dotenv
NEXT_PUBLIC_API_BASE_EXTERNAL=https://api.your-domain.com
```

### 7. 启动服务

```bash
cd /opt/xaitutor
docker compose up -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f
```

访问前端：

```text
http://生产服务器公网IP:3783
```

确认前端请求后端：

```text
http://生产服务器公网IP:8001
```

如果服务器使用云安全组、防火墙或 `ufw`，需要放行：

```text
8001
3783
```

如果后续接入 Nginx 和 HTTPS，可以只对公网开放 `80/443`，由 Nginx 反向代理到容器端口。

## 三、关于端口是否需要在打包前改成 3783

当前默认前端端口已经是 `3783`。

通常不需要为了端口重新打包，因为端口由生产服务器 `.env` 和 compose 控制：

```dotenv
FRONTEND_PORT=3783
```

如果后续要改前端端口，例如改为 `4000`：

```dotenv
FRONTEND_PORT=4000
```

然后重启：

```bash
docker compose up -d
```

如果后端端口也改，例如改为 `9001`：

```dotenv
BACKEND_PORT=9001
NEXT_PUBLIC_API_BASE_EXTERNAL=http://生产服务器公网IP:9001
```

然后重启：

```bash
docker compose up -d
```

注意：

- `NEXT_PUBLIC_API_BASE_EXTERNAL` 是浏览器访问后端的地址。
- 远程生产环境不要留空，否则浏览器可能访问用户本机的 `localhost:8001`。

## 四、后续修改 LLM / Embedding 配置

后续改模型、key、供应商、Embedding、搜索服务，统一改生产服务器的：

```text
/opt/xaitutor/.env
```

修改后执行：

```bash
cd /opt/xaitutor
docker compose up -d
```

常用配置项：

```dotenv
LLM_BINDING=
LLM_MODEL=
LLM_API_KEY=
LLM_HOST=
LLM_API_VERSION=

EMBEDDING_BINDING=
EMBEDDING_MODEL=
EMBEDDING_API_KEY=
EMBEDDING_HOST=
EMBEDDING_DIMENSION=
EMBEDDING_API_VERSION=
EMBEDDING_SEND_DIMENSIONS=

SEARCH_PROVIDER=
SEARCH_API_KEY=
SEARCH_BASE_URL=
```

如果 LLM 或 Embedding 服务部署在生产宿主机上，Linux Docker 容器内不要使用：

```text
localhost
127.0.0.1
```

应使用宿主机局域网 IP，例如：

```dotenv
LLM_HOST=http://192.168.1.100:1234/v1
EMBEDDING_HOST=http://192.168.1.100:1234/v1
```

或者后续单独给 Docker 配置 host gateway。

## 五、后续发布新版本

后续版本更新分为开发服务器操作和生产服务器操作。

### 1. 开发服务器构建新版本

```bash
cd /path/to/XAITutor
docker compose build
docker tag xaitutor:prod xaitutor:prod-YYYYMMDD-HHMM
docker save xaitutor:prod-YYYYMMDD-HHMM -o xaitutor-prod-YYYYMMDD-HHMM.tar
```

示例：

```bash
docker tag xaitutor:prod xaitutor:prod-20260510-1530
docker save xaitutor:prod-20260510-1530 -o xaitutor-prod-20260510-1530.tar
```

### 2. 上传新版本到生产服务器

每次版本更新至少上传：

```text
xaitutor-prod-YYYYMMDD-HHMM.tar
```

如果 `docker-compose.yml` 有变化，还需要上传：

```text
docker-compose.yml
```

如果新增或调整了环境变量，还需要上传模板或人工更新生产 `.env`：

```text
.env.example 或变更说明
```

如果只是代码变更，不需要上传：

```text
.env
data/user
data/knowledge_bases
data/memory
data/tutorbot
```

上传命令示例：

```bash
scp xaitutor-prod-YYYYMMDD-HHMM.tar user@生产服务器IP:/opt/xaitutor/
```

如果 compose 也变了：

```bash
scp docker-compose.prod.yml user@生产服务器IP:/opt/xaitutor/docker-compose.yml
```

### 3. 生产服务器切换到新版本

```bash
cd /opt/xaitutor
docker load -i xaitutor-prod-YYYYMMDD-HHMM.tar
```

修改 `/opt/xaitutor/docker-compose.yml`：

```yaml
image: xaitutor:prod-YYYYMMDD-HHMM
```

重启：

```bash
docker compose up -d
docker compose ps
docker compose logs -f
```

### 4. 更新后的验收

```bash
docker inspect xaitutor --format '{{.Name}} {{.Config.Image}}'
```

确认输出类似：

```text
/xaitutor xaitutor:prod-YYYYMMDD-HHMM
```

浏览器访问：

```text
http://生产服务器公网IP:3783
```

重点检查：

- 前端页面能打开。
- 聊天能正常连接后端。
- 知识库列表和上传功能正常。
- 记忆功能正常。
- 容器重启后数据仍存在。

## 六、版本回滚

如果新版本有问题，生产服务器直接把 compose 镜像 tag 改回旧版本：

```yaml
image: xaitutor:prod-旧版本号
```

然后执行：

```bash
docker compose up -d
docker compose logs -f
```

回滚时不要删除持久化目录：

```text
/opt/xaitutor/data/user
/opt/xaitutor/data/knowledge_bases
/opt/xaitutor/data/memory
/opt/xaitutor/data/tutorbot
```

## 七、首次部署上传清单

全新生产环境首次部署：

```text
必须上传：
- xaitutor-prod-YYYYMMDD.tar
- docker-compose.yml
- .env.example 或 .env.production.example

生产服务器本地创建：
- .env
- data/user
- data/knowledge_bases
- data/memory
- data/tutorbot
```

从开发环境迁移已有数据到生产：

```text
额外上传：
- data/user
- data/knowledge_bases
- data/memory
- data/tutorbot
```

不建议上传：

```text
- 开发环境 .env
- node_modules
- .next
- venv / .venv
- .git
- 日志文件
```

## 八、后续更新上传清单

只更新代码：

```text
上传：
- xaitutor-prod-YYYYMMDD-HHMM.tar

不上传：
- .env
- data/*
```

更新了 compose：

```text
上传：
- xaitutor-prod-YYYYMMDD-HHMM.tar
- docker-compose.yml
```

新增了环境变量：

```text
上传：
- xaitutor-prod-YYYYMMDD-HHMM.tar
- .env.example 或环境变量变更说明

生产服务器操作：
- 手工修改 /opt/xaitutor/.env
- docker compose up -d
```

迁移或恢复数据：

```text
上传：
- data/user
- data/knowledge_bases
- data/memory
- data/tutorbot
```

## 九、常用排查命令

查看容器：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

确认镜像：

```bash
docker images | grep xaitutor
```

确认容器使用的镜像：

```bash
docker inspect xaitutor --format '{{.Name}} {{.Config.Image}}'
```

检查端口监听：

```bash
ss -lntp | grep -E '8001|3783'
```

停止服务：

```bash
docker compose down
```

重新启动：

```bash
docker compose up -d
```

## 十、关键结论

- 除了 tar 包，生产环境还需要 `docker-compose.yml` 和生产 `.env`。
- `.env` 要放在生产服务器 `/opt/xaitutor/.env`，不建议直接上传开发环境 `.env`。
- 端口 `3783` 已经通过 `.env` 控制，通常不需要为了端口重新打包。
- 后续改 LLM、Embedding、搜索和公网 API 地址，都改生产服务器 `/opt/xaitutor/.env`。
- 后续更新版本通常只上传新的镜像 tar 包；只有 compose 或环境变量发生变化时，才额外上传对应文件或变更说明。
