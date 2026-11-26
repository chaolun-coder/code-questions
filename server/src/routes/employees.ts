/**
 * 人员相关路由：/api/employees
 */
import { Hono } from 'hono';
import type { Sql } from '../db/client.js';
import * as employeeService from '../services/employeeService.js';

export function createEmployeeRoutes(sql: Sql): Hono {
  const routes = new Hono();

  /** 人员列表（可按标签筛选：GET /api/employees?tagId=xxx） */
  routes.get('/', async (c) => {
    const tagId = c.req.query('tagId');
    return c.json({ data: await employeeService.list(sql, tagId) });
  });

  /** 单个人员详情 */
  routes.get('/:id', async (c) => {
    return c.json({ data: await employeeService.get(sql, c.req.param('id')) });
  });

  /** 调整直接上级：PATCH /api/employees/:id/manager  body: { managerId: string | null } */
  routes.patch('/:id/manager', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { managerId?: unknown };
    const data = await employeeService.changeManager(sql, c.req.param('id'), body.managerId ?? null);
    return c.json({ data });
  });

  /** 给人员绑定标签：POST /api/employees/:id/tags  body: { tagId: string } */
  routes.post('/:id/tags', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { tagId?: unknown };
    const data = await employeeService.assignTag(sql, c.req.param('id'), body.tagId);
    return c.json({ data }, 201);
  });

  /** 移除人员标签：DELETE /api/employees/:id/tags/:tagId */
  routes.delete('/:id/tags/:tagId', async (c) => {
    const data = await employeeService.unassignTag(sql, c.req.param('id'), c.req.param('tagId'));
    return c.json({ data });
  });

  return routes;
}
