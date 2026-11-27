/**
 * 人员服务：负责输入校验与业务规则编排。
 *
 * 业务规则：
 *  - 人员基础信息（姓名/岗位）只读，不提供增删改；
 *  - 调整上级时必须防循环（不能设为自己或自己的任何下级）；
 *  - 上级可设为 null，表示"无上级"。
 */
import type { Sql } from '../db/client.js';
import { AppError } from '../domain/errors.js';
import type { Employee } from '../domain/types.js';
import { requireText, toLikePattern } from '../domain/validation.js';
import * as employeeRepo from '../repositories/employeeRepository.js';
import * as tagRepo from '../repositories/tagRepository.js';

/** 查询人员列表；标签筛选与姓名/岗位模糊搜索可组合使用 */
export async function list(sql: Sql, tagId?: string, search?: string): Promise<Employee[]> {
  const filter = tagId?.trim();
  if (filter !== undefined && filter === '') {
    throw new AppError('tagId 不能为空字符串');
  }
  const keyword = search?.trim();
  if (keyword !== undefined && keyword.length > 100) {
    throw new AppError('搜索关键词长度不能超过 100 个字符');
  }
  return employeeRepo.listEmployees(sql, filter, keyword ? toLikePattern(keyword) : undefined);
}

/** 查询单个人员 */
export async function get(sql: Sql, id: string): Promise<Employee> {
  const employee = await employeeRepo.findEmployee(sql, requireText(id, '人员 id'));
  if (!employee) throw new AppError('人员不存在', 404);
  return employee;
}

/**
 * 调整直接上级。
 * managerId 为 null 表示设为"无上级"；设为自己或自己的下级会被拒绝（防循环）。
 */
export async function changeManager(
  sql: Sql,
  employeeId: string,
  managerId: unknown,
): Promise<Employee> {
  const id = requireText(employeeId, '人员 id');
  if (managerId !== null && typeof managerId !== 'string') {
    throw new AppError('managerId 必须为字符串或 null');
  }
  const newManagerId = managerId === null ? null : requireText(managerId, 'managerId');

  // 事务内先锁定相关行再检查，避免两个并发请求同时通过环检测后互相成环。
  // 按 id 排序加锁，保证并发事务的加锁顺序一致，避免死锁。
  return sql.begin(async (tx) => {
    const lockedIds = newManagerId === null ? [id] : [id, newManagerId].sort();
    await employeeRepo.lockEmployeesForUpdate(tx, lockedIds);

    const employee = await employeeRepo.findEmployee(tx, id);
    if (!employee) throw new AppError('人员不存在', 404);

    if (newManagerId !== null) {
      const manager = await employeeRepo.findEmployee(tx, newManagerId);
      if (!manager) throw new AppError('上级不存在', 404);
      const hasCycle = await employeeRepo.wouldCreateCycle(tx, id, newManagerId);
      if (hasCycle) {
        throw new AppError('不能将上级设为其本人或其下级，会形成循环汇报关系');
      }
    }

    await employeeRepo.updateManager(tx, id, newManagerId);
    const updated = await employeeRepo.findEmployee(tx, id);
    if (!updated) throw new AppError('人员不存在', 404); // 理论上不会发生，仅用于类型收窄
    return updated;
  });
}

/** 给人员绑定标签 */
export async function assignTag(
  sql: Sql,
  employeeId: string,
  tagId: unknown,
): Promise<Employee> {
  const id = requireText(employeeId, '人员 id');
  const tid = requireText(tagId, 'tagId');
  await get(sql, id);
  const tag = await tagRepo.findTag(sql, tid);
  if (!tag) throw new AppError('标签不存在', 404);
  await employeeRepo.insertEmployeeTag(sql, id, tid);
  return get(sql, id);
}

/** 移除人员身上的标签 */
export async function unassignTag(
  sql: Sql,
  employeeId: string,
  tagId: string,
): Promise<Employee> {
  const id = requireText(employeeId, '人员 id');
  const tid = requireText(tagId, 'tagId');
  await get(sql, id);
  await employeeRepo.deleteEmployeeTag(sql, id, tid);
  return get(sql, id);
}

