/**
 * Cloudflare Workers 入口（运行时可迁移性示例）。
 *
 * 说明：Workers 无法直接建立 TCP 连接，需要通过 Hyperdrive
 * 提供 DATABASE_URL；应用代码与 Node.js 入口完全一致。
 */
import { createApp } from './app.js';
import { createDb, type Sql } from './db/client.js';

export interface Env {
  DATABASE_URL: string;
}

/** 按连接串缓存连接池：Workers isolate 内跨请求复用，避免每请求新建池造成连接泄漏 */
const connections = new Map<string, Sql>();
function getDb(databaseUrl: string): Sql {
  let sql = connections.get(databaseUrl);
  if (!sql) {
    sql = createDb(databaseUrl);
    connections.set(databaseUrl, sql);
  }
  return sql;
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    return createApp(getDb(env.DATABASE_URL)).fetch(request);
  },
};
