/**
 * 应用装配：创建 Hono 应用并挂载路由。
 *
 * 全程使用 Web Standard API（Request/Response），
 * 可在 Node.js / Deno / Bun / Cloudflare Workers 中运行。
 */
import { Hono } from 'hono';
import type { Sql } from './db/client.js';
import { AppError } from './domain/errors.js';
import { createEmployeeRoutes } from './routes/employees.js';
import { createTagRoutes } from './routes/tags.js';

export function createApp(sql: Sql): Hono {
  const app = new Hono();

  app.route('/api/employees', createEmployeeRoutes(sql));
  app.route('/api/tags', createTagRoutes(sql));
  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  /** 全局错误处理：AppError -> 业务状态码，其余 -> 500 */
  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error('[server] unexpected error:', error);
    return c.json({ error: '服务器内部错误' }, 500);
  });

  return app;
}
