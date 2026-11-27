/**
 * HTTP 请求体解析：严格区分「JSON 非法」「不是对象」「字段缺失」，
 * 避免把畸形请求静默当成「字段为 null」处理。
 */
import type { Context } from 'hono';
import { AppError } from '../domain/errors.js';

export async function readJsonObject(c: Context): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    throw new AppError('请求体必须是合法的 JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AppError('请求体必须是 JSON 对象');
  }
  return parsed as Record<string, unknown>;
}
