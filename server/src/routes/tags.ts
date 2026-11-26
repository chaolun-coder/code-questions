/**
 * 标签相关路由：/api/tags
 */
import { Hono } from 'hono';
import type { Sql } from '../db/client.js';
import * as tagService from '../services/tagService.js';

export function createTagRoutes(sql: Sql): Hono {
  const routes = new Hono();

  /** 标签列表 */
  routes.get('/', async (c) => {
    return c.json({ data: await tagService.list(sql) });
  });

  /** 新建标签：POST /api/tags  body: { name: string } */
  routes.post('/', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { name?: unknown };
    return c.json({ data: await tagService.create(sql, body.name) }, 201);
  });

  /** 重命名标签：PATCH /api/tags/:id  body: { name: string } */
  routes.patch('/:id', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { name?: unknown };
    return c.json({ data: await tagService.rename(sql, c.req.param('id'), body.name) });
  });

  /** 删除标签：DELETE /api/tags/:id */
  routes.delete('/:id', async (c) => {
    await tagService.remove(sql, c.req.param('id'));
    return c.body(null, 204);
  });

  return routes;
}
