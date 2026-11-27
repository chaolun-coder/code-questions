/**
 * 本地预览/截图用服务：嵌入式 PostgreSQL + 后端 API + 前端构建产物，单端口 3000。
 * 运行前先执行 `cd web && npm run build`，然后 `cd server && npx tsx scripts/preview-server.ts`。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import postgres from 'postgres';
import { createApp } from '../src/app.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

const db = await PGlite.create();
await db.exec(readFileSync(resolve(root, 'db/schema.sql'), 'utf8'));
await db.exec(readFileSync(resolve(root, 'db/seed.sql'), 'utf8'));

const socket = new PGLiteSocketServer({ db, port: 55432, host: '127.0.0.1' });
await socket.start();

const sql = postgres('postgres://postgres:postgres@127.0.0.1:55432/postgres', { max: 1 });
const app = createApp(sql);
app.use(
  '/*',
  serveStatic({
    root: resolve(root, 'web/dist'),
    rewriteRequestPath: (path) => (path === '/' ? '/index.html' : path),
  }),
);

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('[preview] http://localhost:3000  (PGlite 55432)');
});
