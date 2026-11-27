/**
 * Node.js 入口。
 *
 * 同时托管前端构建产物（web/dist），生产模式单端口即可访问。
 * 其他运行时入口见 src/worker.ts（Cloudflare Workers）。
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb, DEFAULT_DATABASE_URL } from './db/client.js';

const port = Number(process.env.PORT ?? 3000);
const sql = createDb(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);

const app = createApp(sql);

// 托管前端构建产物（若存在）；开发模式下前端走 vite dev server + 代理。
// 路径相对本文件解析，避免依赖启动时的 cwd。
const distRoot =
  process.env.WEB_DIST ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
app.use(
  '/*',
  serveStatic({
    root: distRoot,
    rewriteRequestPath: (path) => (path === '/' ? '/index.html' : path),
  }),
);

serve({ fetch: app.fetch, port }, () => {
  console.log(`[server] http://localhost:${port}  (DATABASE 已连接)`);
});
