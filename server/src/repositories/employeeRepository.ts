/**
 * 人员仓储：负责人员、汇报关系、人员-标签绑定的 SQL 持久化。
 *
 * 本模块只做数据存取，不含业务校验（校验在 service 层）。
 */
import type { Sql } from '../db/client.js';
import type { Employee } from '../domain/types.js';

/**
 * 查询人员列表（含上级姓名与标签），可按标签筛选。
 */
export async function listEmployees(sql: Sql, tagId?: string): Promise<Employee[]> {
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
    ${
      tagId
        ? sql`WHERE EXISTS (
            SELECT 1 FROM employee_tag f
            WHERE f.employee_id = e.id AND f.tag_id = ${tagId}
          )`
        : sql``
    }
    ORDER BY e.name
  `;
}

/**
 * 查询单个人员（含上级姓名与标签）。
 */
export async function findEmployee(sql: Sql, id: string): Promise<Employee | null> {
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
 */
export async function wouldCreateCycle(
  sql: Sql,
  employeeId: string,
  managerId: string,
): Promise<boolean> {
  const rows = await sql<{ hasCycle: boolean }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, manager_id FROM employee WHERE id = ${managerId}
      UNION ALL
      SELECT e.id, e.manager_id
      FROM employee e
      JOIN ancestors a ON e.id = a.manager_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = ${employeeId}) AS "hasCycle"
  `;
  return rows[0]?.hasCycle ?? true; // 查询异常时按有环处理，宁可拒绝不可出错
}

/**
 * 修改某人的直接上级（managerId 为 null 表示设为"无上级"）。
 * 调用方需先完成环检测。
 */
export async function updateManager(
  sql: Sql,
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
  sql: Sql,
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
  sql: Sql,
  employeeId: string,
  tagId: string,
): Promise<void> {
  await sql`
    DELETE FROM employee_tag WHERE employee_id = ${employeeId} AND tag_id = ${tagId}
  `;
}
