/**
 * 标签服务：全局标签池的增删改校验与编排。
 *
 * 业务规则：
 *  - 标签为全局共用标签池，人员只是绑定标签；
 *  - 标签名全局唯一（重命名/新建时校验冲突）；
 *  - 删除标签会同时解除所有人员的绑定。
 */
import type { Sql } from '../db/client.js';
import { AppError } from '../domain/errors.js';
import type { Tag } from '../domain/types.js';
import * as tagRepo from '../repositories/tagRepository.js';

/** 查询全部标签 */
export async function list(sql: Sql): Promise<Tag[]> {
  return tagRepo.listTags(sql);
}

/** 新建标签 */
export async function create(sql: Sql, name: unknown): Promise<Tag> {
  const text = requireName(name);
  const id = crypto.randomUUID();
  return withUniqueGuard(() => tagRepo.insertTag(sql, id, text));
}

/** 重命名标签 */
export async function rename(sql: Sql, id: string, name: unknown): Promise<Tag> {
  const tagId = requireText(id, '标签 id');
  const text = requireName(name);
  const existing = await tagRepo.findTag(sql, tagId);
  if (!existing) throw new AppError('标签不存在', 404);
  return withUniqueGuard(() => tagRepo.updateTagName(sql, tagId, text));
}

/** 删除标签（同时解除所有人员绑定） */
export async function remove(sql: Sql, id: string): Promise<void> {
  const tagId = requireText(id, '标签 id');
  const existing = await tagRepo.findTag(sql, tagId);
  if (!existing) throw new AppError('标签不存在', 404);
  await tagRepo.deleteTag(sql, tagId);
}

/** 标签名校验：非空、去首尾空白、长度限制 */
function requireName(value: unknown): string {
  return requireText(value, '标签名', 50);
}

function requireText(value: unknown, field: string, max = 100): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(`${field} 不能为空`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new AppError(`${field} 长度不能超过 ${max} 个字符`);
  }
  return text;
}

/** 将数据库唯一约束冲突（23505）转换为 409 业务错误 */
async function withUniqueGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new AppError('标签名已存在', 409);
    }
    throw error;
  }
}
