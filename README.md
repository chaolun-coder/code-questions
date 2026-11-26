# 人员组织关系与标签管理

企业内部人员管理系统。人员基础数据由外部系统同步进来，本系统只负责两件事：

1. 维护**人与人之间的上下级汇报关系**（可变更，保留"无上级"状态）；
2. 维护**标签**（全局共用标签池，人员绑定标签），并支持按标签筛选人员。

技术栈：**TypeScript 全栈** · 前端 **React**（网络请求用原生 `fetch`）· 后端 **Web Standard API**（Hono，可运行于 Node.js / Deno / Bun / Cloudflare Workers）· 数据库 **PostgreSQL**。

## 功能清单

- 人员列表：展示姓名、岗位、直接上级、标签
- 调整上级：修改某人的直接上级（可设为"无上级"）
- 标签维护：全局标签池的新建 / 重命名 / 删除
- 人员标签：给人员添加 / 移除标签
- 按标签筛选人员

## 需求规则（已与需求方确认）

- **全局共用标签池**：标签是一套所有人共用的字典，系统可新建 / 改名 / 删除标签，人员只是绑定这些标签；按标签筛选依赖这一设计。
- **防循环汇报**：把一个人的上级设成他自己或他的任何下级都会造成死循环，此类操作会被拒绝并返回错误提示。
- 人员基础信息（姓名 / 岗位）来自外部系统同步，**不提供新增 / 删除 / 编辑接口**。
- 本次验收不做权限、不做登录。

## 快速开始

### 1. 启动 PostgreSQL（含 mock 数据）

```bash
docker compose up -d
```

首次启动会自动执行 `db/schema.sql`（建表）与 `db/seed.sql`（内置 mock 数据：18 名人员、3 层汇报关系、1 名无上级的顶层管理者、4 个标签）。

不用 Docker 也可以手动初始化：

```bash
psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql
```

### 2. 启动后端

```bash
cd server
npm install
npm run dev        # http://localhost:3000
```

环境变量：`DATABASE_URL`（默认 `postgres://postgres:postgres@127.0.0.1:5432/code_questions`）、`PORT`（默认 3000）。

### 3. 启动前端

```bash
cd web
npm install
npm run dev        # http://localhost:5173（/api 自动代理到后端）
```

生产模式：`cd web && npm run build`，然后启动后端（`npm start`），后端会自动托管 `web/dist`，单端口访问。

## 目录结构

```
code-questions/
├── db/
│   ├── schema.sql          # 数据库结构
│   └── seed.sql            # 内置 mock 数据
├── server/                 # 后端（TypeScript + Hono + postgres.js）
│   └── src/
│       ├── app.ts          # 应用装配（路由 + 全局错误处理）
│       ├── index.ts        # Node.js 入口（同时托管前端产物）
│       ├── worker.ts       # Cloudflare Workers 入口（运行时可迁移示例）
│       ├── db/client.ts    # 数据库连接工厂
│       ├── domain/         # 领域模型与错误类型
│       ├── repositories/   # 数据访问层（纯 SQL）
│       ├── services/       # 业务层（校验 + 业务规则）
│       └── routes/         # 路由层（HTTP 协议适配）
└── web/                    # 前端（React + Vite + TypeScript）
    └── src/
        ├── api.ts          # 原生 fetch 封装的 API 客户端
        ├── types.ts        # 与后端一致的数据结构
        └── components/     # 页面组件
```

分层职责：**routes（协议）→ services（业务规则）→ repositories（SQL 持久化）**，各层单一职责，便于测试与扩展。

## 数据库设计

```text
employee（人员，基础字段只读）
  id          TEXT PK      -- 外部系统人员 id
  name        TEXT
  position    TEXT
  manager_id  TEXT FK -> employee(id)   -- 直接上级；NULL = 无上级

tag（全局标签池）
  id    TEXT PK
  name  TEXT UNIQUE        -- 标签名全局唯一

employee_tag（人员-标签 多对多绑定）
  employee_id  TEXT FK -> employee(id) ON DELETE CASCADE
  tag_id       TEXT FK -> tag(id)      ON DELETE CASCADE
  PK (employee_id, tag_id)
```

设计要点：

- 上级关系用 `manager_id` 自引用外键表达，`NULL` 天然支持"无上级"状态；
- 标签是独立字典表 + 关联表，天然支持"全局共用、按标签筛选"；
- 删除标签时绑定关系由外键级联清理，不会留下脏数据。

## API 设计

统一响应：成功 `{ "data": ... }`，失败 `{ "error": "提示信息" }`。

| 方法 | 路径 | 说明 | 请求体 |
|---|---|---|---|
| GET | `/api/employees` | 人员列表（含上级、标签） | — |
| GET | `/api/employees?tagId=:tagId` | 按标签筛选人员 | — |
| GET | `/api/employees/:id` | 人员详情 | — |
| PATCH | `/api/employees/:id/manager` | 调整直接上级 | `{ "managerId": "e002" \| null }` |
| POST | `/api/employees/:id/tags` | 给人员添加标签 | `{ "tagId": "t001" }` |
| DELETE | `/api/employees/:id/tags/:tagId` | 移除人员标签 | — |
| GET | `/api/tags` | 标签列表 | — |
| POST | `/api/tags` | 新建标签 | `{ "name": "核心人才" }` |
| PATCH | `/api/tags/:id` | 重命名标签 | `{ "name": "新名称" }` |
| DELETE | `/api/tags/:id` | 删除标签（解除所有绑定） | — |
| GET | `/api/health` | 健康检查 | — |

错误约定：参数非法 `400`、资源不存在 `404`、标签重名 `409`；调整上级造成循环时报 `400` 并提示"不能将上级设为其本人或其下级，会形成循环汇报关系"。

### 环检测实现

修改上级时，在事务内用递归 CTE 从新上级逐级向上追溯，若途中遇到本人则拒绝：

```sql
WITH RECURSIVE ancestors AS (
  SELECT id, manager_id FROM employee WHERE id = :newManagerId
  UNION ALL
  SELECT e.id, e.manager_id FROM employee e JOIN ancestors a ON e.id = a.manager_id
)
SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = :employeeId) AS has_cycle;
```

## 运行时可迁移性

- 后端全程使用 Web Standard API（`Request`/`Response`），业务代码不绑定任何运行时；
- 数据访问使用 `postgres.js`（Node / Deno / Bun 直连；Cloudflare Workers 经 Hyperdrive），入口见 `server/src/worker.ts`；
- HTTP 框架使用 Hono（WinterCG 兼容），四种运行时共用同一套代码。

## 代码质量说明

- **TypeScript strict** 全量开启（含 `noUncheckedIndexedAccess`），前后端类型一致；
- 分层清晰、命名统一（`createXxxRoutes` / `xxxService` / `xxxRepository`）；
- 关键业务点（环检测、全局标签池、只读人员数据）均有注释说明设计意图；
- 无第三方请求库，前端网络层仅用原生 `fetch` 封装（`web/src/api.ts`）。
