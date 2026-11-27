/**
 * 集成测试：用嵌入式 PostgreSQL（PGlite + TCP socket）跑真实 SQL，
 * 覆盖环检测事务、标签使用人数强校验、搜索/筛选组合、严格请求体解析。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import postgres from 'postgres';
import { createApp } from '../src/app.js';

const PORT = 55432;
const BASE = `http://localhost:${PORT}`;
let db: PGlite;
let socketServer: PGLiteSocketServer;
let sql: postgres.Sql;
let app: ReturnType<typeof createApp>;

before(async () => {
  db = await PGlite.create();
  await db.exec(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../../db/seed.sql', import.meta.url), 'utf8'));
  socketServer = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
  await socketServer.start();
  // PGlite 底层单连接，postgres.js 也限制为单连接
  sql = postgres(`postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`, { max: 1 });
  app = createApp(sql);
});

after(async () => {
  await sql?.end();
  await socketServer?.stop();
  await db?.close();
});

async function request(path: string, init?: RequestInit) {
  const response = await app.request(`${BASE}${path}`, init);
  const body = await response.json().catch(() => null);
  return { status: response.status, body } as {
    status: number;
    body: { data?: any; error?: string } | null;
  };
}

function jsonBody(value: unknown, method = 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

test('健康检查可用', async () => {
  const res = await request('/api/health');
  assert.equal(res.status, 200);
  assert.equal((res.body as { status: string }).status, 'ok');
});

test('标签列表带使用人数', async () => {
  const res = await request('/api/tags');
  assert.equal(res.status, 200);
  const tags = res.body!.data as { id: string; name: string; usageCount: number }[];
  const byId = Object.fromEntries(tags.map((tag) => [tag.id, tag.usageCount]));
  assert.equal(byId.t001, 3);
  assert.equal(byId.t002, 5);
  assert.equal(byId.t003, 4);
  assert.equal(byId.t004, 1);
});

test('删除已使用的标签被拒绝并提示人数', async () => {
  const res = await request('/api/tags/t001', { method: 'DELETE' });
  assert.equal(res.status, 409);
  assert.match(res.body!.error!, /该标签已被 3 人使用，请先解除绑定/);
  // 数据未被破坏
  const list = await request('/api/tags');
  assert.ok((list.body!.data as unknown[]).some((tag: any) => tag.id === 't001'));
});

test('未使用的标签可新建并删除', async () => {
  const created = await request('/api/tags', jsonBody({ name: '临时标签' }));
  assert.equal(created.status, 201);
  const id = (created.body!.data as { id: string }).id;
  assert.ok(id);
  const deleted = await request(`/api/tags/${id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
});

test('标签重名返回 409', async () => {
  const res = await request('/api/tags', jsonBody({ name: '核心人才' }));
  assert.equal(res.status, 409);
  assert.equal(res.body!.error, '标签名已存在');
});

test('把上级设为自己被拒绝', async () => {
  const res = await request('/api/employees/e007/manager', jsonBody({ managerId: 'e007' }, 'PATCH'));
  assert.equal(res.status, 400);
  assert.match(res.body!.error!, /循环汇报关系/);
});

test('把上级设为自己的下级被拒绝', async () => {
  const res = await request('/api/employees/e001/manager', jsonBody({ managerId: 'e007' }, 'PATCH'));
  assert.equal(res.status, 400);
  assert.match(res.body!.error!, /循环汇报关系/);
});

test('上级可设为无上级并持久化', async () => {
  const res = await request('/api/employees/e007/manager', jsonBody({ managerId: null }, 'PATCH'));
  assert.equal(res.status, 200);
  assert.equal((res.body!.data as { managerId: string | null }).managerId, null);
});

test('畸形 JSON 与缺失字段均返回 400，不再静默清空上级', async () => {
  const malformed = await request('/api/employees/e007/manager', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{"managerId":',
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body!.error, '请求体必须是合法的 JSON');

  const missing = await request('/api/employees/e007/manager', jsonBody({}, 'PATCH'));
  assert.equal(missing.status, 400);
  assert.match(missing.body!.error!, /managerId 不能缺失/);
});

test('姓名/岗位模糊搜索与标签筛选可叠加', async () => {
  const res = await request('/api/employees?search=%E5%89%8D%E7%AB%AF&tagId=t002');
  assert.equal(res.status, 200);
  const names = (res.body!.data as { name: string }[]).map((e) => e.name);
  assert.deepEqual(names.sort(), ['李强', '郑楠']);
});

test('搜索中的通配符被转义，不按 LIKE 语义展开', async () => {
  const res = await request('/api/employees?search=%25');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body!.data, []);
});

test('并发互设上级只会成功一个，不会形成环', async () => {
  const [a, b] = await Promise.all([
    request('/api/employees/e004/manager', jsonBody({ managerId: 'e005' }, 'PATCH')),
    request('/api/employees/e005/manager', jsonBody({ managerId: 'e004' }, 'PATCH')),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  assert.match([a, b].find((r) => r.status === 400)!.body!.error!, /循环汇报关系/);
});
