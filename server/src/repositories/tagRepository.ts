/**
 * 标签仓储：负责全局标签池（标签字典）的 SQL 持久化。
 */
import type { Sql } from '../db/client.js';
import type { Tag, TagWithUsage } from '../domain/types.js';

/** 查询全部标签（按名称排序，附带使用人数） */
export async function listTags(sql: Sql): Promise<TagWithUsage[]> {
  return sql<TagWithUsage[]>`
    SELECT t.id, t.name, COUNT(et.employee_id)::int AS "usageCount"
    FROM tag t
    LEFT JOIN employee_tag et ON et.tag_id = t.id
    GROUP BY t.id, t.name
    ORDER BY t.name
  `;
}

/** 统计标签被多少人员使用（删除前强校验用） */
export async function countTagUsage(sql: Sql, id: string): Promise<number> {
  const rows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM employee_tag WHERE tag_id = ${id}
  `;
  return rows[0]?.count ?? 0;
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
