/**
 * Cloudflare Workers 入口（运行时可迁移性示例）。
 *
 * 说明：Workers 无法直接建立 TCP 连接，需要通过 Hyperdrive
 * 提供 DATABASE_URL；应用代码与 Node.js 入口完全一致。
 */
import { createApp } from './app.js';
import { createDb } from './db/client.js';

export interface Env {
  DATABASE_URL: string;
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    return createApp(createDb(env.DATABASE_URL)).fetch(request);
  },
};
