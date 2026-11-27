/**
 * 共享输入校验工具（service 层复用，避免重复实现导致规则漂移）。
 */
import { AppError } from './errors.js';

/** 校验非空文本字段：去首尾空白、限制长度 */
export function requireText(value: unknown, field: string, max = 100): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(`${field} 不能为空`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new AppError(`${field} 长度不能超过 ${max} 个字符`);
  }
  return text;
}

/**
 * 构造 LIKE 匹配串，并转义通配符，避免用户的 % / _ 改变搜索语义。
 * SQL 侧需配合 `ESCAPE '\'`。
 */
export function toLikePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
