/**
 * 后端 API 客户端（原生 fetch 封装，不依赖第三方请求库）。
 *
 * 统一响应结构：{ data: T }；错误响应：{ error: string }。
 */
import type { Employee, Tag, TagWithUsage } from './types';

/** 发起请求并解析统一响应结构 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // 仅携带请求体时设置 JSON 头，避免 GET/DELETE 无谓的 CORS 预检
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new Error('网络请求失败，请检查服务是否已启动');
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: T; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? `请求失败（HTTP ${response.status}）`);
  }
  return body?.data as T;
}

/** 列表查询参数：标签筛选与模糊搜索可叠加 */
export interface EmployeeQuery {
  tagId?: string;
  search?: string;
}

export const api = {
  /** 人员列表；tagId / search 传值时按条件筛选 */
  listEmployees({ tagId, search }: EmployeeQuery = {}): Promise<Employee[]> {
    const query = new URLSearchParams();
    if (tagId) query.set('tagId', tagId);
    if (search) query.set('search', search);
    const qs = query.toString();
    return request<Employee[]>(`/api/employees${qs ? `?${qs}` : ''}`);
  },

  /** 调整直接上级（managerId 为 null 表示无上级） */
  changeManager(employeeId: string, managerId: string | null): Promise<Employee> {
    return request<Employee>(`/api/employees/${encodeURIComponent(employeeId)}/manager`, {
      method: 'PATCH',
      body: JSON.stringify({ managerId }),
    });
  },

  /** 给人员绑定标签 */
  assignTag(employeeId: string, tagId: string): Promise<Employee> {
    return request<Employee>(`/api/employees/${encodeURIComponent(employeeId)}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    });
  },

  /** 移除人员标签 */
  unassignTag(employeeId: string, tagId: string): Promise<Employee> {
    return request<Employee>(
      `/api/employees/${encodeURIComponent(employeeId)}/tags/${encodeURIComponent(tagId)}`,
      { method: 'DELETE' },
    );
  },

  /** 标签列表（含使用人数） */
  listTags(): Promise<TagWithUsage[]> {
    return request<TagWithUsage[]>('/api/tags');
  },

  /** 新建标签 */
  createTag(name: string): Promise<Tag> {
    return request<Tag>('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  /** 重命名标签 */
  renameTag(tagId: string, name: string): Promise<Tag> {
    return request<Tag>(`/api/tags/${encodeURIComponent(tagId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  /** 删除标签（已被使用时后端会拒绝） */
  async deleteTag(tagId: string): Promise<void> {
    await request<void>(`/api/tags/${encodeURIComponent(tagId)}`, { method: 'DELETE' });
  },
};
