/**
 * 人员相关路由：/api/employees
 */
import { Hono } from 'hono';
import type { Sql } from '../db/client.js';
import { AppError } from '../domain/errors.js';
import * as employeeService from '../services/employeeService.js';
import { readJsonObject } from './body.js';

export function createEmployeeRoutes(sql: Sql): Hono {
  const routes = new Hono();

  /** 人员列表：GET /api/employees?tagId=xxx&search=关键词（两种条件可叠加） */
  routes.get('/', async (c) => {
    const tagId = c.req.query('tagId');
    const search = c.req.query('search');
    return c.json({ data: await employeeService.list(sql, tagId, search) });
  });

  /** 单个人员详情 */
  routes.get('/:id', async (c) => {
    return c.json({ data: await employeeService.get(sql, c.req.param('id')) });
  });

  /** 调整直接上级：PATCH /api/employees/:id/manager  body: { managerId: string | null } */
  routes.patch('/:id/manager', async (c) => {
    const body = await readJsonObject(c);
    if (!('managerId' in body)) {
      throw new AppError('managerId 不能缺失（设为无上级请显式传 null）');
    }
    const data = await employeeService.changeManager(sql, c.req.param('id'), body.managerId);
    return c.json({ data });
  });

  /** 给人员绑定标签：POST /api/employees/:id/tags  body: { tagId: string } */
  routes.post('/:id/tags', async (c) => {
    const body = await readJsonObject(c);
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
