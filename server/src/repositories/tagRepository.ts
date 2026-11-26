/**
 * 标签仓储：负责全局标签池（标签字典）的 SQL 持久化。
 */
import type { Sql } from '../db/client.js';
import type { Tag } from '../domain/types.js';

/** 查询全部标签（按名称排序） */
export async function listTags(sql: Sql): Promise<Tag[]> {
  return sql<Tag[]>`SELECT id, name FROM tag ORDER BY name`;
}

/** 按 id 查询标签 */
export async function findTag(sql: Sql, id: string): Promise<Tag | null> {
  const rows = await sql<Tag[]>`SELECT id, name FROM tag WHERE id = ${id}`;
  return rows[0] ?? null;
}

/** 新建标签 */
export async function insertTag(sql: Sql, id: string, name: string): Promise<Tag> {
  const rows = await sql<Tag[]>`
    INSERT INTO tag (id, name) VALUES (${id}, ${name}) RETURNING id, name
  `;
  return rows[0]!;
}

/** 重命名标签 */
export async function updateTagName(sql: Sql, id: string, name: string): Promise<Tag> {
  const rows = await sql<Tag[]>`
    UPDATE tag SET name = ${name} WHERE id = ${id} RETURNING id, name
  `;
  return rows[0]!;
}

/** 删除标签（绑定关系由外键 ON DELETE CASCADE 自动清理） */
export async function deleteTag(sql: Sql, id: string): Promise<void> {
  await sql`DELETE FROM tag WHERE id = ${id}`;
}
