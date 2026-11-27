/**
 * 跨运行时启动入口：同一份业务代码，在 Deno / Bun 下用各自原生 HTTP server 启动。
 *
 * 用法（DATABASE_URL 指向任意 PostgreSQL 兼容连接，PORT 指定监听端口）：
 *   deno run -A --unstable-sloppy-imports scripts/runtime-entry.ts
 *   bun scripts/runtime-entry.ts
 */
import { createApp } from '../src/app.js';
import { createDb, DEFAULT_DATABASE_URL } from '../src/db/client.js';

declare const Deno: {
  serve(options: { port: number }, fetch: (request: Request) => Response | Promise<Response>): unknown;
  env: { get(key: string): string | undefined };
};
declare const Bun: {
  serve(options: { port: number; fetch: (request: Request) => Response | Promise<Response> }): unknown;
  env: { PORT?: string; DATABASE_URL?: string };
};

const runtimeDeno = typeof Deno !== 'undefined';
const runtimeBun = typeof Bun !== 'undefined';

function env(name: 'PORT' | 'DATABASE_URL'): string | undefined {
  if (runtimeDeno) return Deno.env.get(name);
  if (runtimeBun) return Bun.env[name];
  return undefined;
}

const port = Number(env('PORT') ?? 3000);
const databaseUrl = env('DATABASE_URL') ?? DEFAULT_DATABASE_URL;
const app = createApp(createDb(databaseUrl));

if (runtimeBun) {
  Bun.serve({ port, fetch: app.fetch });
  console.log(`[bun] listening on http://localhost:${port}`);
} else if (runtimeDeno) {
  Deno.serve({ port }, app.fetch);
  console.log(`[deno] listening on http://localhost:${port}`);
} else {
  throw new Error('本脚本仅用于 Deno / Bun 运行时验证');
}
