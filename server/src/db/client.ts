/**
 * 数据库连接工厂。
 *
 * 使用 postgres.js（零依赖、支持 Node.js / Deno / Bun，
 * Cloudflare Workers 可通过 Hyperdrive 连接），便于运行时迁移。
 */
import postgres from 'postgres';

/** 本地开发默认连接串，生产环境通过 DATABASE_URL 覆盖 */
export const DEFAULT_DATABASE_URL =
  'postgres://postgres:postgres@127.0.0.1:5432/code_questions';

/** 创建数据库连接实例 */
export function createDb(databaseUrl: string): Sql {
  return postgres(databaseUrl, { max: 10 });
}

export type Sql = postgres.Sql;
