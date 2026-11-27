# 人员组织关系与标签管理

企业内部人员管理系统。人员基础数据由外部系统同步进来，本系统只负责两件事：

1. 维护**人与人之间的上下级汇报关系**（可变更，保留"无上级"状态）；
2. 维护**标签**（全局共用标签池，人员绑定标签），并支持按标签筛选人员。

技术栈：TypeScript 全栈 · 前端 React（原生 `fetch`）· 后端 Web Standard API（Hono）· PostgreSQL。

## 功能清单

- 人员列表：姓名、岗位、直接上级、标签；**姓名/岗位模糊搜索**与**标签筛选**可组合使用
- 调整上级：可设为"无上级"；**事务内加锁 + 环检测**，拒绝自环与成环
- 标签维护：新建 / 重命名 / 删除；列表显示**使用人数**；**已被使用的标签禁止删除**
- 人员标签：给人员添加 / 移除标签
- 操作期间控件禁用，避免重复提交；错误信息统一展示

## 需求规则

- **全局共用标签池**：标签是所有人共用的字典；人员只绑定标签；按标签筛选依赖这一设计。
- **防循环汇报**：把一个人的上级设为自己或其任何下级都会形成死循环，后端强校验拒绝。
- **删除标签强校验**：已绑定人员的标签直接拒绝，提示"该标签已被 X 人使用，请先解除绑定"。不做级联解绑，避免误删悄悄抹掉历史信息。
- 人员基础信息（姓名 / 岗位）来自外部系统同步，**不提供新增 / 删除 / 编辑接口**。
- 本次验收不做权限、不做登录。

## 快速开始

### 方式一：一条命令启动（推荐用于验收 / 同事试用）

```bash
docker compose up -d --build
```

然后打开 **http://localhost:3000** 。一条命令同时拉起 PostgreSQL、后端，并把前端构建产物交由后端单端口托管。首次启动自动执行 `db/schema.sql` 与 `db/seed.sql`（18 名人员、3 层汇报关系、4 个标签）。

默认配置（无需改环境变量）：

| 项 | 默认值 |
|---|---|
| 数据库账号 / 密码 | `postgres` / `postgres` |
| 数据库名 | `code_questions` |
| 数据库端口 | `5432` |
| 应用端口 | `3000` |

停止并清理：`docker compose down`（保留数据加 `-v` 会删除数据卷，请谨慎）。

> 说明：以上 compose 配置已由有 Docker 环境的同事实测通过——一条命令拉起 PostgreSQL + 后端（含前端产物），访问 `http://localhost:3000` 正常，配置无问题。分步开发方式（下面）也已在本机实际跑通。

### 方式二：分步开发（本地 Node）

1. **启动数据库**（需本机 Docker 或自有 PostgreSQL）：

   ```bash
   docker compose up -d db
   # 或：psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql
   ```

2. **启动后端**：

   ```bash
   cd server
   npm install
   npm run dev        # http://localhost:3000
   ```

   环境变量：`DATABASE_URL`（默认 `postgres://postgres:postgres@127.0.0.1:5432/code_questions`）、`PORT`（默认 3000）。

3. **启动前端**：

   ```bash
   cd web
   npm install
   npm run dev        # http://localhost:5173，/api 自动代理到后端
   ```

4. **类型检查 / 测试**：

   ```bash
   cd server && npm run typecheck && npm test
   cd web && npm run typecheck && npm run build
   ```

生产模式（本机）：`cd web && npm run build`，再 `cd ../server && npm start`，后端在 `http://localhost:3000` 同时提供 API 与页面。

## 目录结构

```
code-questions-main/
├── db/
│   ├── schema.sql
│   └── seed.sql
├── server/
│   ├── Dockerfile           # 一条命令镜像：内含前端构建产物
│   └── src/
│       ├── app.ts           # 应用装配（路由 + 全局错误处理）
│       ├── index.ts         # Node.js 入口（托管前端产物）
│       ├── worker.ts        # Cloudflare Workers 入口
│       ├── db/client.ts     # 数据库连接工厂（含事务连接类型）
│       ├── domain/          # 领域模型、错误、共享校验
│       ├── repositories/    # 数据访问层（纯 SQL）
│       ├── services/        # 业务层（校验 + 业务规则 + 事务编排）
│       └── routes/          # 路由层（HTTP 协议适配）
├── web/
│   └── src/
│       ├── api.ts
│       ├── types.ts
│       └── components/
├── docs/screenshots/        # 交付存档：按顺序的操作截图
├── docker-compose.yml
└── README.md
```

分层职责：**routes（协议）→ services（业务规则/事务）→ repositories（SQL 持久化）**。

## 数据库设计

```text
employee（人员，基础字段只读）
  id          TEXT PK
  name        TEXT
  position    TEXT
  manager_id  TEXT FK -> employee(id)   -- NULL = 无上级

tag（全局标签池）
  id    TEXT PK
  name  TEXT UNIQUE

employee_tag（人员-标签 多对多绑定）
  employee_id  TEXT FK -> employee(id)
  tag_id       TEXT FK -> tag(id)
  PK (employee_id, tag_id)
```

标签列表查询会 `LEFT JOIN` 绑定表并统计 `usageCount`；删除标签前先统计使用人数，`> 0` 直接返回 409，**不会**依赖级联删除解绑。

## 关键实现

- **防循环汇报**：事务内先按 id 升序 `SELECT ... FOR UPDATE` 锁定相关人员，再执行环检测与更新，两个并发请求无法同时通过检查。递归 CTE 使用 `UNION`（去重）而非 `UNION ALL`，即使库中已有环也不会无限递归。
- **搜索与筛选**：`GET /api/employees` 的 `search` 与 `tagId` 在 SQL 中用 AND 叠加；搜索值转义 `%` `_` `\` 并配合 `ESCAPE '\'`，避免通配符改变语义。
- **上级下拉**：始终使用全量人员作为候选，标签筛选/搜索后也不会出现下拉值无匹配项的问题；成环拦截由后端保证。
- **严格请求体解析**：JSON 非法、非对象、字段缺失分别返回 400，不再把畸形请求静默当作"设为无上级"。
- **删除标签**：强校验 + 使用人数展示；删除当前筛选中的标签后前端自动重置筛选。

## API 接口清单

统一响应：成功 `{ "data": ... }`；失败 `{ "error": "提示信息" }`。删除标签成功返回 204 无响应体。

| 方法 | 路径 | 参数 | 成功 | 主要失败 |
|---|---|---|---|---|
| GET | `/api/employees` | Query：`tagId?`（标签 id）、`search?`（姓名/岗位关键字），可叠加 | 200 `{data: Employee[]}` | 400 `tagId 不能为空字符串` / 搜索超 100 字符 |
| GET | `/api/employees/:id` | Path：`id` | 200 `{data: Employee}` | 400 id 非法 / 404 人员不存在 |
| PATCH | `/api/employees/:id/manager` | Path：`id`；Body：`{ "managerId": "e002" \| null }`（必须显式传字段） | 200 `{data: Employee}` | 400 JSON 非法 / 字段缺失 / 类型错误 / **循环汇报**；404 人员或上级不存在 |
| POST | `/api/employees/:id/tags` | Path：`id`；Body：`{ "tagId": "t001" }` | 201 `{data: Employee}` | 400 参数非法 / 404 标签不存在 |
| DELETE | `/api/employees/:id/tags/:tagId` | Path：`id`, `tagId` | 200 `{data: Employee}` | 400 参数非法 / 404 人员不存在 |
| GET | `/api/tags` | — | 200 `{data: TagWithUsage[]}`（含 `usageCount`） | — |
| POST | `/api/tags` | Body：`{ "name": "核心人才" }` | 201 `{data: Tag}` | 400 名称为空/超 50 字符 / 409 重名 |
| PATCH | `/api/tags/:id` | Path：`id`；Body：`{ "name": "新名称" }` | 200 `{data: Tag}` | 400 / 404 标签不存在 / 409 重名 |
| DELETE | `/api/tags/:id` | Path：`id` | 204 无响应体 | 404 标签不存在 / **409 `该标签已被 X 人使用，请先解除绑定`** |
| GET | `/api/health` | — | 200 `{ "status": "ok" }` | — |

错误码约定：`400` 参数/业务规则非法，`404` 资源不存在，`409` 标签重名或标签仍被使用，`500` 未预期异常。

数据结构：

```ts
interface Employee {
  id: string; name: string; position: string;
  managerId: string | null; managerName: string | null;
  tags: { id: string; name: string }[];
}
interface TagWithUsage { id: string; name: string; usageCount: number; }
```

## 运行时验证情况

后端全程使用 Web Standard API（`Request`/`Response`），业务代码不绑定具体运行时；`worker.ts` 内连接池按连接串缓存，避免每请求新建池。

| 运行时 | 状态 |
|---|---|
| Node.js 22 | **已实际验证**：类型检查、12 项集成测试、本地启动与页面操作均通过 |
| Deno 2.9 | **已实际验证**：`deno run -A --unstable-sloppy-imports scripts/runtime-entry.ts` 启动成功，`GET /api/health`、`GET /api/tags`（含 `usageCount`）、`GET /api/employees?search=...` 均返回正确结果 |
| Bun 1.4 | **已实际验证**：`bun scripts/runtime-entry.ts` 启动成功，健康检查与标签/人员业务接口返回正确结果 |
| Cloudflare Workers | **未验证**（无 Hyperdrive 环境）；`worker.ts` 仅提供入口示例，接入前请按平台文档验证 |

说明：Deno / Bun 使用同一份业务代码（`src/app.ts`、`src/db/client.ts` 等），仅启动入口不同（`scripts/runtime-entry.ts` 按运行时选用 `Deno.serve` / `Bun.serve`）。验证时数据库为 PGlite over TCP（PostgreSQL  wire protocol），与生产 PostgreSQL 协议兼容；该嵌入式库同一时刻只接受一个连接池，因此两个运行时需分别单独启动验证，不能同时连接。

## 交付存档

`docs/screenshots/` 下为按顺序编号的 10 张操作截图，覆盖：初始列表 → 搜索 + 标签筛选 → 改上级成功 → 循环汇报被拦截 → 标签新建 → 重命名 → 删除已使用标签被拒绝 / 未使用标签删除成功 → 给人员打标 → 按标签筛选。

复现方式（本机使用系统 Edge）：

```bash
cd web && npm run build
cd ../server && npx tsx scripts/preview-server.ts   # 终端 A：单端口 3000
cd ../server && node scripts/capture.mjs             # 终端 B：生成截图
```

跨运行时验证方式（需先启动 PGlite，两个运行时分开跑，不要同时连库）：

```bash
cd server
npx tsx scripts/preview-server.ts   # 终端 A：数据库监听 55432
# 终端 B（Deno，端口 3101）：
PORT=3101 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres \
  deno run -A --unstable-sloppy-imports scripts/runtime-entry.ts
# 或终端 B（Bun，端口 3102）：
PORT=3102 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres \
  bun scripts/runtime-entry.ts
curl http://localhost:3101/api/health   # 或 3102
```
