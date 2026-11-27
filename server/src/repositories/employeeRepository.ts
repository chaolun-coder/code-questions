/**
 * 人员仓储：负责人员、汇报关系、人员-标签绑定的 SQL 持久化。
 *
 * 本模块只做数据存取，不含业务校验（校验在 service 层）。
 */
import type { Queryable } from '../db/client.js';
import type { Employee } from '../domain/types.js';

/**
 * 查询人员列表（含上级姓名与标签），标签筛选与姓名/岗位模糊搜索可叠加。
 * searchPattern 由 service 层用 toLikePattern 生成（已转义通配符）。
 */
export async function listEmployees(
  sql: Queryable,
  tagId?: string,
  searchPattern?: string,
): Promise<Employee[]> {
  const tagCondition = tagId
    ? sql`EXISTS (SELECT 1 FROM employee_tag f WHERE f.employee_id = e.id AND f.tag_id = ${tagId})`
    : null;
  const searchCondition = searchPattern
    ? sql`(e.name ILIKE ${searchPattern} ESCAPE '\\' OR e.position ILIKE ${searchPattern} ESCAPE '\\')`
    : null;
  const where =
    tagCondition && searchCondition
      ? sql`WHERE ${tagCondition} AND ${searchCondition}`
      : tagCondition
        ? sql`WHERE ${tagCondition}`
        : searchCondition
          ? sql`WHERE ${searchCondition}`
          : sql``;

  return sql<Employee[]>`
    SELECT
      e.id,
      e.name,
      e.position,
      e.manager_id   AS "managerId",
      m.name         AS "managerName",
      COALESCE(t.tags, '[]'::json) AS tags
    FROM employee e
    LEFT JOIN employee m ON m.id = e.manager_id
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name) ORDER BY tg.name) AS tags
      FROM employee_tag et
      JOIN tag tg ON tg.id = et.tag_id
      WHERE et.employee_id = e.id
    ) t ON TRUE
    ${where}
    ORDER BY e.name
  `;
}

/**
 * 查询单个人员（含上级姓名与标签）。
 */
export async function findEmployee(sql: Queryable, id: string): Promise<Employee | null> {
  const rows = await sql<Employee[]>`
    SELECT
      e.id,
      e.name,
      e.position,
      e.manager_id   AS "managerId",
      m.name         AS "managerName",
      COALESCE(t.tags, '[]'::json) AS tags
    FROM employee e
    LEFT JOIN employee m ON m.id = e.manager_id
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name) ORDER BY tg.name) AS tags
      FROM employee_tag et
      JOIN tag tg ON tg.id = et.tag_id
      WHERE et.employee_id = e.id
    ) t ON TRUE
    WHERE e.id = ${id}
  `;
  return rows[0] ?? null;
}

/**
 * 判断"把 employeeId 的上级设为 managerId"是否会形成循环汇报。
 *
 * 从 managerId 逐级向上追溯，若途中遇到 employeeId（或 managerId 本身就是
 * employeeId），说明新关系会形成环，必须拒绝。
 *
 * 使用 UNION（去重）而非 UNION ALL：即使库中已有环（例如外部同步写入），
 * 递归也会在重复行处终止，不会无限递归。
 */
export async function wouldCreateCycle(
  sql: Queryable,
  employeeId: string,
  managerId: string,
): Promise<boolean> {
  const rows = await sql<{ hasCycle: boolean }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, manager_id FROM employee WHERE id = ${managerId}
      UNION
      SELECT e.id, e.manager_id
      FROM employee e
      JOIN ancestors a ON e.id = a.manager_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = ${employeeId}) AS "hasCycle"
  `;
  return rows[0]?.hasCycle ?? true; // 结果缺失时保守拒绝；查询异常会直接抛出，由上层转为 500
}

/**
 * 在事务内锁定相关行（调用方需按 id 升序传入，避免并发死锁）。
 * 锁定后其他事务无法同时改动这些人的上级，使「环检测 + 更新」原子化。
 */
export async function lockEmployeesForUpdate(sql: Queryable, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql`SELECT id FROM employee WHERE id IN ${sql(ids)} ORDER BY id FOR UPDATE`;
}

/**
 * 修改某人的直接上级（managerId 为 null 表示设为"无上级"）。
 * 调用方需先完成环检测。
 */
export async function updateManager(
  sql: Queryable,
  employeeId: string,
  managerId: string | null,
): Promise<void> {
  await sql`
    UPDATE employee SET manager_id = ${managerId} WHERE id = ${employeeId}
  `;
}

/**
 * 给人员绑定标签（重复绑定会被 ON CONFLICT 忽略）。
 */
export async function insertEmployeeTag(
  sql: Queryable,
  employeeId: string,
  tagId: string,
): Promise<void> {
  await sql`
    INSERT INTO employee_tag (employee_id, tag_id)
    VALUES (${employeeId}, ${tagId})
    ON CONFLICT DO NOTHING
  `;
}

/**
 * 移除人员身上的标签绑定。
 */
export async function deleteEmployeeTag(
  sql: Queryable,
  employeeId: string,
  tagId: string,
): Promise<void> {
  await sql`
    DELETE FROM employee_tag WHERE employee_id = ${employeeId} AND tag_id = ${tagId}
  `;
}
