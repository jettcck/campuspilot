# CampusPilot API 文档

- 基础地址：`http://localhost:3001/api`（生产环境为 `https://你的域名/api`）
- 数据格式：`application/json`
- 鉴权方式：除标注「公开」的接口外，均需在请求头携带 Token

```http
Authorization: Bearer <JWT_TOKEN>
```

## 统一响应结构

成功：

```json
{ "success": true, "message": "操作成功", "data": { }, "error": null }
```

失败：

```json
{ "success": false, "message": "任务不存在", "data": null, "error": { "code": "TASK_NOT_FOUND", "message": "任务不存在" } }
```

## 状态码约定

| 状态码 | 含义 |
| --- | --- |
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未登录或 Token 失效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（邮箱已注册、重复加入等） |
| 500 | 服务器内部错误 |

---

## 一、健康检查

### GET /health（公开）

```json
{ "success": true, "message": "CampusPilot API is running", "data": { "time": "2026-10-01T02:00:00.000Z" } }
```

---

## 二、认证模块

### POST /auth/register（公开）

请求：

```json
{ "username": "张三", "email": "zhangsan@example.com", "password": "123456", "school": "示例大学", "major": "软件工程", "grade": "大二" }
```

响应：

```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "token": "eyJhbGciOi...",
    "user": { "id": "8f2c...", "username": "张三", "email": "zhangsan@example.com", "role": "student" }
  }
}
```

约束：邮箱格式校验、邮箱唯一、密码至少 6 位。

### POST /auth/login（公开）

请求：

```json
{ "email": "demo@campuspilot.dev", "password": "Demo123456" }
```

响应结构同注册。

### GET /auth/me

返回当前登录用户。

### PUT /auth/profile

请求：

```json
{ "username": "新昵称", "school": "示例大学", "major": "计算机科学", "grade": "大三" }
```

### PUT /auth/password

请求：

```json
{ "oldPassword": "Demo123456", "newPassword": "NewPass123" }
```

---

## 三、任务模块

### GET /tasks

查询参数：

| 参数 | 说明 |
| --- | --- |
| status | `done` / `todo` |
| courseId | 按课程筛选 |
| keyword | 标题关键词模糊搜索 |
| limit | 返回条数上限 |

响应：

```json
{
  "success": true,
  "data": {
    "tasks": [
      { "id": "t1", "title": "完成 React Hooks 练习", "meta": "前端工程实践 · 预计 45 分钟", "tag": "今天", "color": "mint", "priority": "high", "done": false, "estimatedMinutes": 45, "courseId": "c1" }
    ],
    "total": 3
  }
}
```

### POST /tasks

```json
{ "title": "复习数据库事务", "meta": "数据库原理 · 预计 30 分钟", "tag": "明天", "color": "yellow", "courseId": "c2", "priority": "high", "estimatedMinutes": 30 }
```

### GET /tasks/:id

### PUT /tasks/:id

可更新字段：`title`、`meta`、`tag`、`color`、`courseId`、`priority`、`dueDate`、`estimatedMinutes`。

### PATCH /tasks/:id/status

```json
{ "done": true }
```

### DELETE /tasks/:id

---

## 四、课程与资料

### GET /courses

### POST /courses

```json
{ "name": "数据库原理", "teacher": "李老师", "semester": "2024 秋", "color": "blue", "nextClass": "下周一 09:00", "tags": ["MySQL", "事务"] }
```

### PUT /courses/:id

可更新字段：`name`、`teacher`、`semester`、`color`、`description`、`tags`、`progress`、`nextClass`。

### DELETE /courses/:id

### GET /files?courseId=

### POST /files

`multipart/form-data`，字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| file | File | 必填，单文件 ≤ 10MB |
| courseId | String | 可选，归属课程 |

允许的扩展名：`pdf / doc / docx / ppt / pptx / txt / md / png / jpg / jpeg / zip`

### POST /files/:id/summarize

调用 AI 服务生成资料摘要并写回记录。

### DELETE /files/:id

---

## 五、学习计划

### GET /study-plans?status=active

### GET /study-plans/:id

### PATCH /study-plans/:id/step

```json
{ "index": 2, "done": true }
```

勾选后返回重新计算好 `progress` 与 `status` 的计划对象。

### DELETE /study-plans/:id

---

## 六、AI 模块

### GET /ai/status

无需登录。用于确认 AI 是否真正接通（而不是静默走兜底）。

响应：

```json
{
  "success": true,
  "data": {
    "provider": "deepseek",
    "providerLabel": "DeepSeek",
    "model": "deepseek-chat",
    "baseUrl": "https://api.deepseek.com/v1",
    "keyUrl": "https://platform.deepseek.com/api_keys",
    "configured": false,
    "reachable": false,
    "mode": "local-fallback",
    "message": "未配置 AI_API_KEY，当前使用内置规则引擎"
  }
}
```

`mode` 取值：`local-fallback`（未配置 Key）、`remote`（已连通）、`remote-error`（已配置但调用失败，`message` 中给出原因）。

### POST /ai/chat

```json
{ "prompt": "数据结构里哈希冲突怎么处理？" }
```

响应：

```json
{ "success": true, "data": { "reply": "…", "provider": "local-fallback", "prompt": "…" } }
```

`provider` 为模型名时表示调用了真实大模型，为 `local-fallback` 表示使用了内置规则引擎。

### POST /ai/study-plan

```json
{ "goal": "两周内掌握 React 基础并完成一个项目", "days": 7 }
```

响应：

```json
{
  "success": true,
  "data": {
    "plan": { "id": "p1", "goal": "…", "progress": 0, "status": "active", "steps": [ { "day": 1, "title": "第 1 天：基础概念与术语", "minutes": 60, "point": "…" } ] },
    "ai": { "goal": "…", "days": 7, "steps": [], "provider": "local-fallback" }
  }
}
```

### POST /ai/summarize

```json
{ "text": "需要总结的课件或笔记内容" }
```

### POST /ai/quiz

```json
{ "topic": "操作系统的进程调度" }
```

### GET /ai/history?limit=20

### GET /ai/advise

基于当前用户的学习数据生成 3 条改进建议，同时返回统计数据。

---

## 七、小组模块

### GET /groups

返回我参与的小组，包含 `memberCount` 与 `members` 列表。

### POST /groups

```json
{ "name": "Web 大作业小组", "description": "完成课程设计的前后端实现" }
```

### POST /groups/join

```json
{ "inviteCode": "A1B2C3" }
```

### DELETE /groups/:id

仅组长可操作。

---

## 八、校园信息

### GET /notices?category=讲座（公开）

### POST /notices

```json
{ "title": "周三学术讲座", "category": "讲座", "content": "时间地点与主讲人信息", "source": "计算机学院" }
```

---

## 九、统计模块

### GET /stats/overview

```json
{
  "success": true,
  "data": {
    "stats": {
      "weeklyMinutes": 135, "weeklyHours": 2.3, "completionRate": 33,
      "doneCount": 1, "totalCount": 3, "streak": 0,
      "activePlans": 1, "courseCount": 3, "topCourse": "前端工程实践",
      "courseRanking": [ { "name": "前端工程实践", "count": 1 } ]
    }
  }
}
```

### GET /stats/weekly

```json
{ "success": true, "data": { "weekly": [ { "label": "一", "date": "2026-09-28", "minutes": 0 } ] } }
```

---

## 十、错误码速查

| code | 含义 |
| --- | --- |
| PARAM_MISSING | 缺少必填参数 |
| EMAIL_INVALID / EMAIL_EXISTS | 邮箱格式错误 / 邮箱已注册 |
| PASSWORD_WEAK | 密码长度不足 |
| CREDENTIALS_INVALID | 邮箱或密码错误 |
| OLD_PASSWORD_INVALID | 原密码不正确 |
| UNAUTHORIZED / TOKEN_INVALID | 未登录 / Token 失效 |
| FORBIDDEN | 无权限 |
| TASK_NOT_FOUND / COURSE_NOT_FOUND / FILE_NOT_FOUND / PLAN_NOT_FOUND / GROUP_NOT_FOUND | 资源不存在 |
| FILE_MISSING / FILE_TYPE_NOT_ALLOWED | 未选择文件 / 文件类型不允许 |
| INVITE_INVALID / ALREADY_JOINED | 邀请码无效 / 已是成员 |
| STEP_INVALID | 计划步骤序号不正确 |