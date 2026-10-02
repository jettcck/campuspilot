# CampusPilot · 大学生智能学习与校园协作平台

[![CI](https://github.com/jettcck/campuspilot/actions/workflows/ci.yml/badge.svg)](https://github.com/jettcck/campuspilot/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)
![Deploy](https://img.shields.io/badge/deploy-Render-46E3B7?logo=render&logoColor=black)

一个面向大学生的全栈 Web 应用：把**学习计划、课程资料、AI 学习助手、小组协作、校园信息、学习数据可视化**集中在一个工作台里。

项目覆盖完整的全栈开发流程：需求分析 → 系统设计 → 前端开发 → 后端开发 → 数据库设计 → API 设计 → 身份认证 → AI 集成 → 测试 → 容器化部署。

---

## 在线演示

| 项 | 值 |
| --- | --- |
| 访问地址 | https://campuspilot-0yx1.onrender.com |
| 使用方式 | 自行注册账号后登录，数据按用户完全隔离 |
| 健康检查 | https://campuspilot-0yx1.onrender.com/api/health/ready |

线上环境说明：

| 组件 | 方案 |
| --- | --- |
| 应用托管 | Render 免费实例（Docker 部署，自动 HTTPS） |
| 数据库 | MongoDB Atlas 免费集群（M0，512 MB） |
| AI 服务 | DeepSeek `deepseek-chat`（OpenAI 兼容协议） |
| CI | GitHub Actions（构建 + 冒烟测试 + 生产启动校验 + 镜像校验） |

> 站点不存在任何公共演示账号：所有内容都归属注册账号本人，避免多人共用同一身份。
> 新账号注册后工作台为空，总览页提供「一键导入示例数据」，导入的是你自己的私有数据，可随时删除。
> 免费实例闲置 15 分钟后会休眠，**首次访问需等待 30–60 秒冷启动**，之后访问流畅。
> 上传的课程资料存放于实例临时磁盘，重新部署后会清空；课程、任务、学习计划等数据均在 Atlas 中，不受影响。

---

## 一、技术栈

| 层次 | 技术选型 |
| --- | --- |
| 前端 | React 18 + Vite、哈希路由、Context 状态管理、CSS 变量主题、响应式布局 |
| 后端 | Node.js + Express、分层架构（routes → controllers → services → 数据层） |
| 数据库 | MongoDB（Mongoose）/ 本地 JSON 文件（零依赖模式） |
| 认证 | JWT（jsonwebtoken）+ bcrypt 密码哈希 + 权限中间件 |
| 安全 | helmet 安全响应头、分级限流（防暴力破解）、zod 入参校验、CORS 白名单、生产配置 fail-fast |
| 可观测 | pino 结构化日志、请求追踪 ID、存活/就绪双探针、优雅关闭 |
| AI | OpenAI 兼容协议（OpenAI / DeepSeek / 通义千问 / 智谱 / Ollama），无 Key 时自动降级为内置规则引擎 |
| 文件 | multer 上传 + 扩展名白名单 + 静态托管 |
| 部署 | Docker 多阶段构建 + Render 云托管（自动 HTTPS）+ docker-compose + Nginx 反向代理 + GitHub Actions |

---

## 二、功能清单

| 模块 | 功能 |
| --- | --- |
| 用户认证 | 注册、登录、JWT 鉴权、资料修改、密码修改 |
| 学习计划 | AI 按天拆解学习目标、步骤勾选、进度自动计算 |
| 任务管理 | 任务增删改查、完成状态切换、按状态/课程/关键词筛选 |
| 课程资料 | 课程管理、资料上传、在线查看、AI 生成资料摘要 |
| AI 学习室 | 学习问答、资料总结、生成自测题、个性化学习建议、对话历史 |
| 小组协作 | 创建小组、邀请码加入、成员展示、组长解散 |
| 校园信息 | 讲座 / 比赛 / 通知 / 活动分类浏览 |
| 数据可视化 | 本周学习时长、任务完成率、连续学习天数、7 天专注趋势柱状图、完成率环形图 |

---

## 三、快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量（可选）

```bash
cp .env.example .env
```

不配置任何变量也能直接运行 —— 此时使用本地文件存储 + 内置 AI 规则引擎。

### 3. 启动后端

```bash
npm run server
# 接口地址 http://localhost:3001/api
```

### 4. 启动前端（开发模式）

```bash
npm run dev
# 访问 http://localhost:5173
```

### 5. 首次使用

首次启动会自动写入校园公告这类公共内容，**不会创建任何账号**。
打开页面点击「注册」创建账号后登录，总览页会提供「一键导入示例数据」，
导入 3 门示例课程与 3 条示例任务（写入你自己的账号空间，可随时删除）。

### 6. 冒烟测试

```bash
npm run smoke
# 自包含运行：使用临时目录 + 本地文件存储，不依赖外部数据库
# 覆盖健康检查、注册鉴权、输入校验、越权防护、引导流程、分页、限流
```

### 7. 生产模式（单进程部署）

```bash
npm run build
NODE_ENV=production npm start
# 访问 http://localhost:3001
```

生产模式下 Express 同时托管前端页面与 API，只需暴露一个端口。
生产环境启动前会校验配置：`JWT_SECRET` 缺失或过短、`MONGODB_URI` 未配置都会直接拒绝启动。

---

## 四、项目结构

```text
campuspilot/
├── src/                        # 前端
│   ├── api/client.js           # 统一 API 客户端（自动附带 JWT）
│   ├── components/             # 布局、图表、全局提示
│   ├── context/                # 登录状态
│   ├── hooks/                  # 通用数据请求 Hook
│   ├── pages/                  # 7 个业务页面
│   ├── App.jsx                 # 哈希路由与鉴权守卫
│   └── styles.css              # 设计系统与主题
├── server/                     # 后端
│   ├── config/                 # 环境变量、Schema 定义
│   ├── middleware/             # 鉴权、入参校验、安全策略、日志、错误处理
│   ├── controllers/            # 业务控制器
│   ├── services/               # AI 服务、统计服务、基础数据
│   ├── validation/             # zod 接口契约
│   ├── routes/index.js         # 全部路由注册
│   ├── utils/                  # 数据存储、JWT、响应封装
│   ├── app.js                  # Express 应用装配
│   └── index.js                # 启动入口与优雅关闭
├── scripts/smoke-test.mjs      # 自包含冒烟测试
├── docs/                       # 开发文档 / API 文档 / 用户手册 / 部署手册 / 技术博客
├── deploy/nginx.conf           # 反向代理配置
├── Dockerfile                  # 多阶段镜像构建
└── docker-compose.yml          # 应用 + Nginx 编排
```

---

## 五、设计要点

**1. 数据层双模式**
`server/utils/store.js` 提供统一的异步集合接口。未配置 `MONGODB_URI` 时使用本地 JSON 文件持久化，配置后自动切换为 MongoDB，业务代码零改动。这样项目在评审、演示、离线环境下都能直接跑起来。

**2. AI 服务抽象**
`server/services/aiService.js` 把「模型调用」与「业务逻辑」解耦，通过环境变量切换厂商。未配置 Key 时使用内置规则引擎产出结构化结果，保证功能链路完整可演示。

**3. 分层架构**
路由只负责注册，参数校验与业务逻辑放在控制器，跨模块能力（AI、统计）放在服务层，所有异常由全局错误中间件统一转成 JSON 响应。

**4. 统一响应结构**

```json
{ "success": true, "message": "操作成功", "data": {}, "error": null }
```

**5. 入参校验前置**
所有写入接口在进入控制器之前先经过 zod 契约校验，类型、长度、取值范围一次拦截，
未声明字段会被直接丢弃，从入口消除批量赋值（mass assignment）风险。

**6. 身份与数据隔离**
不存在共享演示账号。每个账号的数据通过 `userId` 强制隔离，接口层统一校验归属，
列表接口全部走分页与复合索引，删除课程时级联清理关联数据，不留孤儿记录。

**7. 生产可运行性**
启动前校验必需配置（缺失即拒绝启动）；`/api/health` 用于容器存活判定，
`/api/health/ready` 校验数据源就绪后返回 200/503；收到 SIGTERM 先停流量再释放数据库连接。

---

## 六、文档索引

| 文档 | 路径 |
| --- | --- |
| 开发文档 | [docs/开发文档.md](docs/开发文档.md) |
| API 文档 | [docs/API.md](docs/API.md) |
| 用户手册 | [docs/用户手册.md](docs/用户手册.md) |
| 部署手册 | [docs/部署手册.md](docs/部署手册.md) |
| 技术博客 | [docs/技术博客.md](docs/技术博客.md) |

---

## 七、常用命令

```bash
npm run dev       # 前端开发服务器（含 /api 代理）
npm run server    # 启动后端 API
npm run build     # 构建前端产物到 dist/
npm run smoke     # 冒烟测试（自包含，无需外部数据库）
npm start         # 生产模式启动（需先 build）
docker compose up -d --build   # 容器化部署
```